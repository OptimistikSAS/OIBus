import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { DateTime } from 'luxon';
import * as forge from 'node-forge';

import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import { PresentedServerIdentity, ServerIdentity, TrustedServerIdentity } from '../../shared/model/domain/server-identity.model';

import { OIBusValidationError } from '../model/types';
import {
  getCertificateStoreTrustSettings,
  resolveTestedServerTrust,
  retrievePresentedServerIdentity,
  retrieveServerIdentityToTrust,
  testConnectionWithServerIdentity,
  toCertificateStoreServerTrust,
  toImportedServerTrust,
  toServerNotTrustedError,
  toServerTrust,
  toServerTrustDTO,
  toServerTrustStateDTO,
  trustFormCertificateInStore
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

    it('should compare the fingerprints of certificates whatever their case and separators', async () => {
      const retrieve = mock.fn(async () => other);

      assert.strictEqual(await resolveTestedServerTrust(saved, 'ab:cd', retrieve), saved);
      assert.deepStrictEqual(await resolveTestedServerTrust(saved, 'ef01', retrieve), {
        identity: { ...other, trustedBy: '', trustedAt: '' },
        trustOnFirstUse: false
      });
      assert.strictEqual(await retrieveServerIdentityToTrust({ retrieveServerIdentity: async () => other }, 'ef-01'), other);
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

      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, null, false), {
        items: [{ key: 'State', value: 'Running' }]
      });
    });

    it('should test the connection to a trusted server, with its identity', async () => {
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, trusted, false), {
        items: [{ key: 'State', value: 'Running' }],
        serverIdentity: { identity, status: 'trusted' }
      });
    });

    it('should not test further the connection to a server not trusted', async () => {
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, null, true), {
        items: [],
        serverIdentity: { identity, status: 'unknown' }
      });
      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, { ...trusted, fingerprint: 'EF:01' }, true), {
        items: [],
        serverIdentity: { identity, status: 'changed' }
      });
      assert.strictEqual(connector.testConnection.mock.callCount(), 0);
    });

    it('should fail the test of a server not trusted for a caller which does not show its identity', async () => {
      await assert.rejects(
        testConnectionWithServerIdentity(connector, null, false),
        new Error(
          'The server presents the certificate AB:CD, which is not trusted: the connection was not tested further. Review its identity and trust it to connect'
        )
      );
      await assert.rejects(
        testConnectionWithServerIdentity(connector, { ...trusted, fingerprint: 'EF:01' }, false),
        new Error(
          'The server presents the certificate AB:CD, which is not the trusted one: the connection was not tested further. Review its identity and trust it to connect'
        )
      );
      assert.strictEqual(connector.testConnection.mock.callCount(), 0);
    });
  });

  describe('with a connector telling the trust status itself (a TLS connector)', () => {
    it('should test the connection to a server whose certificate validates, whatever the trusted identity', async () => {
      const connector = {
        retrieveServerIdentity: async () => identity,
        getServerIdentityTrustStatus: () => 'trusted' as const,
        testConnection: async () => ({ items: [] })
      };

      assert.deepStrictEqual(await testConnectionWithServerIdentity(connector, null, false), {
        items: [],
        serverIdentity: { identity, status: 'trusted' }
      });
      assert.deepStrictEqual(
        await retrievePresentedServerIdentity({ ...connector, getServerIdentityTrustStatus: () => 'changed' }, trusted),
        {
          identity,
          status: 'changed'
        }
      );
    });
  });

  describe('getCertificateStoreTrustSettings', () => {
    const objectAttribute = (enablingConditions: OIBusObjectAttribute['enablingConditions']): OIBusObjectAttribute => ({
      type: 'object',
      key: 'settings',
      translationKey: '',
      displayProperties: { visible: true, wrapInBox: false },
      enablingConditions,
      validators: [],
      attributes: []
    });
    const enabledWithoutModule = objectAttribute([
      { referralPathFromRoot: 'useOiaModule', targetPathFromRoot: 'specificSettings', values: [false] }
    ]);

    it('should give no settings for a connector not trusting a certificate of the store', () => {
      assert.strictEqual(getCertificateStoreTrustSettings({ settings: objectAttribute([]) }, { certificateValidation: 'trusted' }), null);
    });

    it('should give the settings themselves', () => {
      const settings = { certificateValidation: 'trusted' };
      assert.strictEqual(
        getCertificateStoreTrustSettings({ serverTrustInCertificateStore: true, settings: objectAttribute([]) }, settings),
        settings
      );
    });

    it('should give their object attribute named by the manifest, while it is enabled', () => {
      const manifest = { serverTrustInCertificateStore: true, serverTrustSettingsKey: 'specificSettings', settings: enabledWithoutModule };
      const specificSettings = { certificateValidation: 'trusted' };

      assert.strictEqual(getCertificateStoreTrustSettings(manifest, { useOiaModule: false, specificSettings }), specificSettings);
      assert.strictEqual(getCertificateStoreTrustSettings(manifest, { useOiaModule: true, specificSettings }), null);
      assert.strictEqual(getCertificateStoreTrustSettings(manifest, { useOiaModule: false, specificSettings: null }), null);
    });
  });

  describe('trustFormCertificateInStore', () => {
    const certificateIdentity: ServerIdentity = {
      type: 'x509',
      fingerprint: 'AB:CD',
      details: { certificate: '-----BEGIN CERTIFICATE-----' } as ServerIdentity['details']
    };

    it('should add the certificate trusted in the form to the store, and select it', () => {
      const settings: Record<string, unknown> = { certificateValidation: 'standard', trustedCertificateId: null };
      const trustCertificate = mock.fn((_certificate: string) => ({ id: 'trustedId' }));

      assert.deepStrictEqual(
        trustFormCertificateInStore(
          settings,
          { identity: null, trustOnFirstUse: true },
          { identity: certificateIdentity },
          true,
          trustCertificate
        ),
        { identity: null, trustOnFirstUse: false }
      );
      assert.deepStrictEqual(trustCertificate.mock.calls[0].arguments, ['-----BEGIN CERTIFICATE-----']);
      assert.deepStrictEqual(settings, { certificateValidation: 'trusted', trustedCertificateId: 'trustedId' });
    });

    it('should keep no identity in the trust of a connector trusting the store, without certificate in its form', () => {
      const trustCertificate = mock.fn((_certificate: string) => ({ id: 'trustedId' }));

      assert.deepStrictEqual(
        trustFormCertificateInStore({}, { identity: trusted, trustOnFirstUse: true }, { identity }, true, trustCertificate),
        { identity: null, trustOnFirstUse: true }
      );
      assert.strictEqual(trustCertificate.mock.callCount(), 0);
    });

    it('should keep no identity when the settings selecting the certificate are disabled', () => {
      const trustCertificate = mock.fn((_certificate: string) => ({ id: 'trustedId' }));

      assert.deepStrictEqual(
        trustFormCertificateInStore(
          null,
          { identity: null, trustOnFirstUse: true },
          { identity: certificateIdentity },
          true,
          trustCertificate
        ),
        { identity: null, trustOnFirstUse: true }
      );
      assert.strictEqual(trustCertificate.mock.callCount(), 0);
    });

    it('should keep the trust of the other connectors', () => {
      const serverTrust = { identity: trusted, trustOnFirstUse: false };

      assert.strictEqual(
        trustFormCertificateInStore({}, serverTrust, { identity: certificateIdentity }, false, () => ({ id: 'id' })),
        serverTrust
      );
    });
  });

  describe('toCertificateStoreServerTrust', () => {
    it('should show the certificate of the store a connector trusts as the identity it trusts', () => {
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const certificate = forge.pki.createCertificate();
      certificate.publicKey = keys.publicKey;
      certificate.setSubject([{ shortName: 'CN', value: 'server' }]);
      certificate.setIssuer([{ shortName: 'CN', value: 'server' }]);
      certificate.sign(keys.privateKey, forge.md.sha256.create());
      const pem = forge.pki.certificateToPem(certificate);
      const findCertificate = () => ({ certificate: pem, createdBy: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });

      const serverTrust = toCertificateStoreServerTrust(
        { certificateValidation: 'trusted', trustedCertificateId: 'trustedId' },
        { identity: null, trustOnFirstUse: false },
        findCertificate
      );
      assert.strictEqual(serverTrust.identity!.fingerprint, new crypto.X509Certificate(pem).fingerprint256);
      assert.strictEqual(serverTrust.identity!.trustedBy, 'admin');
      assert.strictEqual(serverTrust.identity!.trustedAt, '2026-01-01T00:00:00.000Z');
      assert.deepStrictEqual(toCertificateStoreServerTrust(null, { identity: null, trustOnFirstUse: true }, findCertificate), {
        identity: null,
        trustOnFirstUse: true
      });

      assert.deepStrictEqual(
        toCertificateStoreServerTrust({ certificateValidation: 'standard' }, { identity: null, trustOnFirstUse: true }, findCertificate),
        { identity: null, trustOnFirstUse: true }
      );
    });
  });

  describe('retrievePresentedServerIdentity', () => {
    it('should give the identity the server presents and how it compares with the trusted one', async () => {
      assert.deepStrictEqual(await retrievePresentedServerIdentity({ retrieveServerIdentity: async () => identity }, trusted), {
        identity,
        status: 'trusted'
      });
      assert.deepStrictEqual(await retrievePresentedServerIdentity({ retrieveServerIdentity: async () => other }, trusted), {
        identity: other,
        status: 'changed'
      });
      assert.strictEqual(await retrievePresentedServerIdentity({ retrieveServerIdentity: async () => null }, trusted), null);
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
