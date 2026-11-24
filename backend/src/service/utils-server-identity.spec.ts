import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import { before, describe, it } from 'node:test';

import * as forge from 'node-forge';

import { ServerIdentity, X509ServerIdentityDetails } from '../../shared/model/domain/server-identity.model';

import { encryptionService } from './encryption.service';
import {
  describeServerIdentity,
  getServerIdentityTrustStatus,
  NO_SERVER_TRUST,
  toSshHostKeyServerIdentity,
  toTrustedServerIdentity,
  toX509ServerIdentity
} from './utils-server-identity';

/** A certificate of `commonName` issued by a certificate authority, with a URI holding a comma in its subject alternative names. */
const issueCertificate = (commonName: string): Buffer => {
  const toForgeKeys = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    return {
      publicKey: forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }) as string),
      privateKey: forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }) as string)
    };
  };
  const caKeys = toForgeKeys();
  const keys = toForgeKeys();
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '0a1b';
  certificate.validity.notBefore = new Date('2026-01-01T00:00:00.000Z');
  certificate.validity.notAfter = new Date('2027-01-01T00:00:00.000Z');
  certificate.setSubject([{ shortName: 'CN', value: commonName }]);
  certificate.setIssuer([{ shortName: 'CN', value: 'My CA' }]);
  certificate.setExtensions([
    {
      name: 'subjectAltName',
      altNames: [
        { type: 6, value: 'urn:server,with:comma' },
        { type: 2, value: 'server.local' }
      ]
    }
  ]);
  certificate.sign(caKeys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(), 'binary');
};

/** An SSH host key in the wire format: the length of its type, its type, then the key. */
const toHostKey = (keyType: string, key: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(keyType.length);
  return Buffer.concat([length, Buffer.from(keyType, 'ascii'), key]);
};

describe('Service utils server identity', () => {
  let selfSignedCertificate: Buffer;
  let issuedCertificate: Buffer;

  before(async () => {
    const { cert } = await encryptionService.generateSelfSignedCertificate({
      commonName: 'OPC UA server',
      countryName: 'FR',
      stateOrProvinceName: '',
      localityName: '',
      organizationName: 'Optimistik',
      keySize: 2048,
      daysBeforeExpiry: 365
    });
    selfSignedCertificate = new crypto.X509Certificate(cert).raw;
    issuedCertificate = issueCertificate('Issued server');
  });

  describe('toX509ServerIdentity', () => {
    it('should give the identity of a self-signed certificate', () => {
      const identity = toX509ServerIdentity(selfSignedCertificate);
      const x509 = new crypto.X509Certificate(selfSignedCertificate);

      assert.deepStrictEqual(identity, {
        type: 'x509',
        fingerprint: x509.fingerprint256,
        details: {
          subject: x509.subject,
          issuer: x509.issuer,
          serialNumber: x509.serialNumber,
          validFrom: x509.validFromDate.toISOString(),
          validTo: x509.validToDate.toISOString(),
          uris: [`urn:${os.hostname()}:OIBus`],
          dnsNames: [os.hostname(), 'localhost'],
          ipAddresses: ['127.0.0.1', '0:0:0:0:0:0:0:1'],
          selfSigned: true
        }
      });
    });

    it('should give the identity of a certificate issued by a certificate authority', () => {
      const details = toX509ServerIdentity(issuedCertificate).details as X509ServerIdentityDetails;

      assert.strictEqual(details.subject, 'CN=Issued server');
      assert.strictEqual(details.issuer, 'CN=My CA');
      assert.strictEqual(details.validFrom, '2026-01-01T00:00:00.000Z');
      assert.strictEqual(details.validTo, '2027-01-01T00:00:00.000Z');
      // a name holding a comma is quoted by Node
      assert.deepStrictEqual(details.uris, ['urn:server,with:comma']);
      assert.deepStrictEqual(details.dnsNames, ['server.local']);
      assert.deepStrictEqual(details.ipAddresses, []);
      assert.strictEqual(details.selfSigned, false);
    });

    it('should not consider self-signed a certificate whose signature cannot be checked', () => {
      const x509 = new crypto.X509Certificate(selfSignedCertificate);
      const verify = x509.verify;
      Object.defineProperty(crypto.X509Certificate.prototype, 'verify', {
        configurable: true,
        value: () => {
          throw new Error('unsupported');
        }
      });
      try {
        assert.strictEqual((toX509ServerIdentity(selfSignedCertificate).details as X509ServerIdentityDetails).selfSigned, false);
      } finally {
        Object.defineProperty(crypto.X509Certificate.prototype, 'verify', { configurable: true, value: verify });
      }
    });

    it('should not give the identity of what is not a certificate', () => {
      assert.throws(() => toX509ServerIdentity(Buffer.from('not a certificate')));
    });
  });

  describe('toSshHostKeyServerIdentity', () => {
    it('should give the identity of an SSH host key, with the fingerprint ssh-keygen shows', () => {
      const hostKey = toHostKey('ssh-ed25519', crypto.randomBytes(36));

      assert.deepStrictEqual(toSshHostKeyServerIdentity(hostKey), {
        type: 'ssh-host-key',
        fingerprint: `SHA256:${crypto.createHash('sha256').update(hostKey).digest('base64').replace(/=+$/, '')}`,
        details: { keyType: 'ssh-ed25519' }
      });
    });

    it('should give an unknown key type for a malformed host key', () => {
      assert.deepStrictEqual(toSshHostKeyServerIdentity(Buffer.from([0, 0, 0, 50, 1])).details, { keyType: 'unknown' });
      assert.deepStrictEqual(toSshHostKeyServerIdentity(Buffer.from([1])).details, { keyType: 'unknown' });
    });
  });

  describe('getServerIdentityTrustStatus', () => {
    const identity: ServerIdentity = { type: 'ssh-host-key', fingerprint: 'SHA256:abc', details: { keyType: 'ssh-ed25519' } };

    it('should compare the type and the fingerprint only', () => {
      assert.strictEqual(getServerIdentityTrustStatus(identity, null), 'unknown');
      assert.strictEqual(getServerIdentityTrustStatus(identity, { ...identity, details: { keyType: 'other' } }), 'trusted');
      assert.strictEqual(getServerIdentityTrustStatus(identity, { ...identity, fingerprint: 'SHA256:def' }), 'changed');
      assert.strictEqual(getServerIdentityTrustStatus(identity, { ...identity, type: 'x509' }), 'changed');
    });
  });

  it('should give a trusted identity, without the other fields of the identity', () => {
    const identity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa' }, extra: true } as ServerIdentity;

    assert.deepStrictEqual(toTrustedServerIdentity(identity, 'admin', '2026-01-01T00:00:00.000Z'), {
      type: 'x509',
      fingerprint: 'AB:CD',
      details: { keyType: 'rsa' },
      trustedBy: 'admin',
      trustedAt: '2026-01-01T00:00:00.000Z'
    });
  });

  it('should describe an identity for the logs', () => {
    assert.strictEqual(describeServerIdentity({ type: 'x509', fingerprint: 'AB:CD', details: { keyType: '' } }), 'certificate AB:CD');
    assert.strictEqual(
      describeServerIdentity({ type: 'ssh-host-key', fingerprint: 'SHA256:abc', details: { keyType: '' } }),
      'host key SHA256:abc'
    );
  });

  it('should not trust any identity by default', () => {
    assert.deepStrictEqual(NO_SERVER_TRUST, { identity: null, trustOnFirstUse: false });
    assert.ok(Object.isFrozen(NO_SERVER_TRUST));
  });
});
