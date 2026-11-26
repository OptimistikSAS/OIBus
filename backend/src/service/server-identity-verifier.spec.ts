import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import { ServerIdentity, ServerTrust, TrustedServerIdentity } from '../../shared/model/domain/server-identity.model';

import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import ServerIdentityVerifier from './server-identity-verifier';

const presented: ServerIdentity = { type: 'ssh-host-key', fingerprint: 'SHA256:presented', details: { keyType: 'ssh-ed25519' } };
const trusted: TrustedServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:trusted',
  details: { keyType: 'ssh-ed25519' },
  trustedBy: 'admin',
  trustedAt: '2026-01-01T00:00:00.000Z'
};

describe('ServerIdentityVerifier', () => {
  let trust: ServerTrust;
  let logger: PinoLogger;
  let setTrust: ReturnType<typeof mock.fn<(serverTrust: ServerTrust) => void>>;
  let verifier: ServerIdentityVerifier;

  beforeEach(() => {
    trust = { identity: null, trustOnFirstUse: false };
    logger = new PinoLogger();
    setTrust = mock.fn((serverTrust: ServerTrust) => {
      trust = serverTrust;
    });
    verifier = new ServerIdentityVerifier(
      () => trust,
      setTrust,
      () => logger
    );
  });

  it('should go on with the trusted identity', () => {
    trust = { identity: { ...trusted, fingerprint: presented.fingerprint }, trustOnFirstUse: false };

    assert.strictEqual(verifier.verify(presented), true);
    assert.strictEqual(verifier.pendingIdentity, null);
    assert.strictEqual(setTrust.mock.callCount(), 0);
    assert.strictEqual(logger.error.mock.callCount(), 0);
  });

  it('should refuse an identity when none is trusted, and keep it as pending', () => {
    assert.strictEqual(verifier.verify(presented), false);

    assert.deepStrictEqual(verifier.pendingIdentity, { identity: presented, status: 'unknown' });
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
      'Connection refused: the server presents the host key SHA256:presented, which is not trusted. Review it and trust it to connect'
    ]);
  });

  it('should keep as pending an identity a TLS validation refused', () => {
    verifier.refuse(presented, 'changed');
    assert.deepStrictEqual(verifier.pendingIdentity, { identity: presented, status: 'changed' });
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
      'Connection refused: the server presents the host key SHA256:presented, which does not validate against the trusted certificate. Review it and trust it to connect'
    ]);

    verifier.refuse(presented, 'unknown');
    assert.deepStrictEqual(verifier.pendingIdentity, { identity: presented, status: 'unknown' });
  });

  it('should refuse an identity which is not the trusted one', () => {
    trust = { identity: trusted, trustOnFirstUse: true };

    assert.strictEqual(verifier.verify(presented), false);

    // trusting on first use only applies when no identity is trusted
    assert.deepStrictEqual(verifier.pendingIdentity, { identity: presented, status: 'changed' });
    assert.strictEqual(setTrust.mock.callCount(), 0);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
      'Connection refused: the server presents the host key SHA256:presented, which is not the trusted one (host key SHA256:trusted). Review it and trust it to connect'
    ]);
  });

  it('should trust the first identity received when trusting on first use, and publish it to be saved', () => {
    trust = { identity: null, trustOnFirstUse: true };
    const saved = mock.fn((_identity: TrustedServerIdentity) => undefined);
    verifier.events.on('trusted-on-first-use', saved);

    assert.strictEqual(verifier.verify(presented), true);

    const identity = saved.mock.calls[0].arguments[0];
    assert.strictEqual(identity.fingerprint, presented.fingerprint);
    assert.strictEqual(identity.trustedBy, 'system');
    assert.ok(identity.trustedAt);
    assert.deepStrictEqual(setTrust.mock.calls[0].arguments, [{ identity, trustOnFirstUse: false }]);
    assert.strictEqual(verifier.pendingIdentity, null);
    assert.deepStrictEqual(logger.info.mock.calls[0].arguments, ['Server host key SHA256:presented trusted at the first connection']);
    // the next connections check it
    assert.strictEqual(verifier.verify({ ...presented, fingerprint: 'SHA256:other' }), false);
  });

  it('should forget the pending identity once the trusted identity is presented, or on reset', () => {
    verifier.verify(presented);
    trust = { identity: { ...trusted, fingerprint: presented.fingerprint }, trustOnFirstUse: false };
    verifier.verify(presented);
    assert.strictEqual(verifier.pendingIdentity, null);

    verifier.verify({ ...presented, fingerprint: 'SHA256:other' });
    assert.notStrictEqual(verifier.pendingIdentity, null);
    verifier.reset();
    assert.strictEqual(verifier.pendingIdentity, null);
  });
});
