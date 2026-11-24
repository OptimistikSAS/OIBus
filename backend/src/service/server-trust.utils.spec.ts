import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { DateTime } from 'luxon';

import { OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import { PresentedServerIdentity, ServerIdentity, TrustedServerIdentity } from '../../shared/model/domain/server-identity.model';

import { OIBusValidationError } from '../model/types';
import {
  resolveTestedServerTrust,
  retrieveServerIdentityToTrust,
  testConnectionWithServerIdentity,
  toImportedServerTrust,
  toServerNotTrustedError,
  toServerTrust,
  toServerTrustDTO,
  toServerTrustStateDTO
} from './server-trust.utils';

const identity: ServerIdentity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa' } };
const trusted: TrustedServerIdentity = { ...identity, trustedBy: 'admin', trustedAt: '2026-01-01T00:00:00.000Z' };
const other: ServerIdentity = { ...identity, fingerprint: 'EF:01' };

describe('Server trust utils', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-01T00:00:00.000Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  describe('toServerTrust', () => {
    it('should keep the current trust when the command has none', () => {
      const current = { identity: trusted, trustOnFirstUse: false };

      assert.strictEqual(toServerTrust(undefined, current, 'user'), current);
      assert.deepStrictEqual(toServerTrust(undefined, null, 'user'), { identity: null, trustOnFirstUse: false });
    });

    it('should trust no identity', () => {
      assert.deepStrictEqual(toServerTrust({ identity: null }, { identity: trusted, trustOnFirstUse: false }, 'user'), {
        identity: null,
        trustOnFirstUse: false
      });
      assert.deepStrictEqual(toServerTrust({ identity: null, trustOnFirstUse: true }, null, 'user'), {
        identity: null,
        trustOnFirstUse: true
      });
    });

    it('should keep who trusted the identity already trusted, and when', () => {
      assert.deepStrictEqual(
        toServerTrust(
          { identity: { ...identity, trustedBy: 'someone', trustedAt: 'never' } },
          { identity: trusted, trustOnFirstUse: false },
          'user'
        ),
        { identity: trusted, trustOnFirstUse: false }
      );
    });

    it('should trust a new identity by the user saving the connector, now', () => {
      // who trusted it and when are not taken from the command
      assert.deepStrictEqual(
        toServerTrust(
          { identity: { ...other, trustedBy: 'someone', trustedAt: 'never' } },
          { identity: trusted, trustOnFirstUse: true },
          'user'
        ),
        { identity: { ...other, trustedBy: 'user', trustedAt: '2026-06-01T00:00:00.000Z' }, trustOnFirstUse: false }
      );
    });
  });

  describe('toImportedServerTrust', () => {
    it('should keep the trust as exported', () => {
      assert.deepStrictEqual(toImportedServerTrust({ identity: trusted, trustOnFirstUse: false }, 'importer'), {
        identity: trusted,
        trustOnFirstUse: false
      });
      assert.deepStrictEqual(toImportedServerTrust({ identity: null, trustOnFirstUse: true }, 'importer'), {
        identity: null,
        trustOnFirstUse: true
      });
      assert.deepStrictEqual(toImportedServerTrust(undefined, 'importer'), { identity: null, trustOnFirstUse: false });
      assert.deepStrictEqual(toImportedServerTrust({ identity: null }, 'importer'), { identity: null, trustOnFirstUse: false });
    });

    it('should trust an identity exported without who trusted it by the importer, now', () => {
      assert.deepStrictEqual(toImportedServerTrust({ identity, trustOnFirstUse: false }, 'importer'), {
        identity: { ...identity, trustedBy: 'importer', trustedAt: DateTime.now().toUTC().toISO() },
        trustOnFirstUse: false
      });
    });
  });

  describe('resolveTestedServerTrust', () => {
    const saved = { identity: trusted, trustOnFirstUse: false };

    it('should give the saved trust without fingerprint, or with the saved one, without asking the server', async () => {
      const retrieve = mock.fn(async () => other);

      assert.strictEqual(await resolveTestedServerTrust(saved, null, retrieve), saved);
      assert.strictEqual(await resolveTestedServerTrust(saved, identity.fingerprint, retrieve), saved);
      assert.strictEqual(retrieve.mock.callCount(), 0);
    });

    it('should trust the identity of the fingerprint trusted in the form when the server presents it', async () => {
      assert.deepStrictEqual(await resolveTestedServerTrust(saved, other.fingerprint, async () => other), {
        identity: { ...other, trustedBy: '', trustedAt: '' },
        trustOnFirstUse: false
      });
    });

    it('should give the saved trust when the server does not present the fingerprint trusted in the form', async () => {
      assert.strictEqual(await resolveTestedServerTrust(saved, 'other', async () => other), saved);
      assert.strictEqual(await resolveTestedServerTrust(saved, 'other', async () => null), saved);
    });
  });

  describe('testConnectionWithServerIdentity', () => {
    let connector: {
      retrieveServerIdentity: ReturnType<typeof mock.fn<() => Promise<ServerIdentity | null>>>;
      testConnection: ReturnType<typeof mock.fn<() => Promise<OIBusConnectionTestResult>>>;
    };

    beforeEach(() => {
      connector = {
        retrieveServerIdentity: mock.fn(async (): Promise<ServerIdentity | null> => identity),
        testConnection: mock.fn(async () => ({ items: [{ key: 'State', value: 'Running' }] }))
      };
    });

    it('should test the connection of a connector which does not check its server', async () => {
      connector.retrieveServerIdentity.mock.mockImplementation(async () => null);

      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, null), { items: [{ key: 'State', value: 'Running' }] });
    });

    it('should test the connection to a trusted server, with its identity', async () => {
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, trusted), {
        items: [{ key: 'State', value: 'Running' }],
        serverIdentity: { identity, status: 'trusted' }
      });
    });

    it('should not test further the connection to a server not trusted', async () => {
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, null), {
        items: [],
        serverIdentity: { identity, status: 'unknown' }
      });
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, { ...trusted, fingerprint: 'EF:01' }), {
        items: [],
        serverIdentity: { identity, status: 'changed' }
      });
      assert.strictEqual(connector.testConnection.mock.callCount(), 0);
    });
  });

  describe('retrieveServerIdentityToTrust', () => {
    it('should give the identity the server presents when it has the fingerprint to trust', async () => {
      assert.strictEqual(
        await retrieveServerIdentityToTrust({ retrieveServerIdentity: async () => identity }, identity.fingerprint),
        identity
      );
    });

    it('should refuse an identity of another fingerprint', async () => {
      await assert.rejects(
        () => retrieveServerIdentityToTrust({ retrieveServerIdentity: async () => other }, identity.fingerprint),
        new OIBusValidationError('The server presents the certificate EF:01, not the one to trust (AB:CD): test the connection again')
      );
    });

    it('should refuse to trust an identity for a connector which does not check it', async () => {
      await assert.rejects(
        () => retrieveServerIdentityToTrust({ retrieveServerIdentity: async () => null }, identity.fingerprint),
        new OIBusValidationError('The connector does not check the identity of its server with its current settings')
      );
    });
  });

  describe('toServerNotTrustedError', () => {
    const error = new Error('server Certificate verification failed');

    it('should tell how to trust the server when the connection was refused', () => {
      const pending: PresentedServerIdentity = { identity, status: 'unknown' };

      assert.deepStrictEqual(
        toServerNotTrustedError({ isServerNotTrusted: () => true, getPendingServerIdentity: () => pending }, error),
        new Error(
          'The server presents the certificate AB:CD, which is not trusted: test the connection to review its identity and trust it'
        )
      );
    });

    it('should keep any other error', () => {
      assert.strictEqual(toServerNotTrustedError({ isServerNotTrusted: () => false, getPendingServerIdentity: () => null }, error), error);
    });
  });

  it('should give the trust with the user who trusted the identity', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: `${id} name` });

    assert.deepStrictEqual(toServerTrustDTO({ identity: trusted, trustOnFirstUse: false }, getUserInfo), {
      identity: { ...trusted, trustedBy: { id: 'admin', friendlyName: 'admin name' } },
      trustOnFirstUse: false
    });
    assert.deepStrictEqual(toServerTrustDTO({ identity: null, trustOnFirstUse: true }, getUserInfo), {
      identity: null,
      trustOnFirstUse: true
    });
    assert.deepStrictEqual(
      toServerTrustStateDTO({ identity: null, trustOnFirstUse: false, pending: { identity, status: 'unknown' } }, getUserInfo),
      { identity: null, trustOnFirstUse: false, pending: { identity, status: 'unknown' } }
    );
  });
});
