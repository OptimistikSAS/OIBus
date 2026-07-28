import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as forge from 'node-forge';
import { OIBusValidationError } from '../model/types';
import {
  certificateContentToPem,
  splitPemChain,
  certificatePemToDer,
  readCertificate,
  privateKeyContentToPem,
  assertKeyMatchesCertificate,
  privateKeyToEncryptedPkcs8Pem
} from './utils-certificate';

const buildSelfSignedCertificate = (keys: forge.pki.rsa.KeyPair, commonName: string): forge.pki.Certificate => {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(19));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ shortName: 'CN', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return cert;
};

describe('utils-certificate', () => {
  let keys: forge.pki.rsa.KeyPair;
  let cert: forge.pki.Certificate;
  let certPem: string;
  let privateKeyPkcs1Pem: string;
  let otherKeys: forge.pki.rsa.KeyPair;

  before(() => {
    keys = forge.pki.rsa.generateKeyPair(1024);
    cert = buildSelfSignedCertificate(keys, 'oibus-test');
    certPem = forge.pki.certificateToPem(cert);
    privateKeyPkcs1Pem = forge.pki.privateKeyToPem(keys.privateKey);
    otherKeys = forge.pki.rsa.generateKeyPair(1024);
  });

  describe('certificateContentToPem', () => {
    it('returns the PEM as-is when the content is already PEM', () => {
      const result = certificateContentToPem(Buffer.from(certPem, 'utf8'));
      assert.strictEqual(result, certPem);
    });

    it('converts a DER certificate to PEM', () => {
      const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
      const derBuffer = Buffer.from(der, 'binary');
      const result = certificateContentToPem(derBuffer);
      assert.strictEqual(forge.pki.certificateToPem(forge.pki.certificateFromPem(result)), certPem);
    });

    it('round-trips PEM -> DER -> PEM', () => {
      const der = certificatePemToDer(certPem);
      const result = certificateContentToPem(der);
      assert.strictEqual(forge.pki.certificateFromPem(result).serialNumber, cert.serialNumber);
    });

    it('throws an OIBusValidationError for garbage content', () => {
      assert.throws(() => certificateContentToPem(Buffer.from([1, 2, 3, 4, 5])), OIBusValidationError);
    });
  });

  describe('splitPemChain', () => {
    it('splits a bundle of two certificates into individual PEMs', () => {
      const secondCert = buildSelfSignedCertificate(otherKeys, 'oibus-test-2');
      const secondCertPem = forge.pki.certificateToPem(secondCert);
      const bundle = `${certPem}\n${secondCertPem}`;

      const result = splitPemChain(bundle);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(forge.pki.certificateFromPem(result[0]).serialNumber, cert.serialNumber);
      assert.strictEqual(forge.pki.certificateFromPem(result[1]).serialNumber, secondCert.serialNumber);
    });
  });

  describe('readCertificate', () => {
    it('extracts the public key and the real expiry from the certificate', () => {
      const result = readCertificate(certPem);
      assert.strictEqual(result.publicKeyPem, forge.pki.publicKeyToPem(keys.publicKey));
      // X.509 validity has second precision, so the expiry is compared against the re-parsed certificate
      assert.strictEqual(result.expiry, forge.pki.certificateFromPem(certPem).validity.notAfter.toISOString());
    });

    it('throws an OIBusValidationError when the certificate cannot be parsed', () => {
      assert.throws(() => readCertificate('not a certificate'), OIBusValidationError);
    });
  });

  describe('privateKeyContentToPem', () => {
    it('normalizes a PKCS#1 private key', () => {
      const result = privateKeyContentToPem(Buffer.from(privateKeyPkcs1Pem, 'utf8'), null);
      assert.strictEqual(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(result)), privateKeyPkcs1Pem);
    });

    it('normalizes a PKCS#8 private key', () => {
      const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey));
      const pkcs8Pem = forge.pki.privateKeyInfoToPem(pkcs8Asn1);

      const result = privateKeyContentToPem(Buffer.from(pkcs8Pem, 'utf8'), null);

      assert.strictEqual(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(result)), privateKeyPkcs1Pem);
    });

    it('decrypts an encrypted PKCS#8 private key with the correct passphrase', () => {
      const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey));
      const encryptedPem = forge.pki.encryptedPrivateKeyToPem(forge.pki.encryptPrivateKeyInfo(pkcs8Asn1, 'right-pass'));

      const result = privateKeyContentToPem(Buffer.from(encryptedPem, 'utf8'), 'right-pass');

      assert.strictEqual(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(result)), privateKeyPkcs1Pem);
    });

    it('throws an OIBusValidationError for an encrypted PKCS#8 key with the wrong passphrase', () => {
      const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey));
      const encryptedPem = forge.pki.encryptedPrivateKeyToPem(forge.pki.encryptPrivateKeyInfo(pkcs8Asn1, 'right-pass'));

      assert.throws(() => privateKeyContentToPem(Buffer.from(encryptedPem, 'utf8'), 'wrong-pass'), OIBusValidationError);
    });

    it('throws an OIBusValidationError for an encrypted key with no passphrase provided', () => {
      const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey));
      const encryptedPem = forge.pki.encryptedPrivateKeyToPem(forge.pki.encryptPrivateKeyInfo(pkcs8Asn1, 'right-pass'));

      assert.throws(() => privateKeyContentToPem(Buffer.from(encryptedPem, 'utf8'), null), OIBusValidationError);
    });

    it('decrypts a legacy PKCS#1 key with DEK-Info using the correct passphrase', () => {
      const legacyPem = forge.pki.encryptRsaPrivateKey(keys.privateKey, 'legacy-pass');

      const result = privateKeyContentToPem(Buffer.from(legacyPem, 'utf8'), 'legacy-pass');

      assert.strictEqual(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(result)), privateKeyPkcs1Pem);
    });

    it('converts a DER-encoded private key to PEM', () => {
      const der = forge.asn1.toDer(forge.pki.privateKeyToAsn1(keys.privateKey)).getBytes();
      const derBuffer = Buffer.from(der, 'binary');

      const result = privateKeyContentToPem(derBuffer, null);

      assert.strictEqual(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(result)), privateKeyPkcs1Pem);
    });
  });

  describe('assertKeyMatchesCertificate', () => {
    it('does not throw when the private key matches the certificate public key', () => {
      assert.doesNotThrow(() => assertKeyMatchesCertificate(certPem, privateKeyPkcs1Pem));
    });

    it('throws an OIBusValidationError when the private key does not match the certificate public key', () => {
      const otherPrivateKeyPem = forge.pki.privateKeyToPem(otherKeys.privateKey);
      assert.throws(() => assertKeyMatchesCertificate(certPem, otherPrivateKeyPem), OIBusValidationError);
    });
  });

  describe('privateKeyToEncryptedPkcs8Pem', () => {
    it('produces a PEM starting with the encrypted PKCS#8 header, loadable by node crypto with the right passphrase', () => {
      const encrypted = privateKeyToEncryptedPkcs8Pem(privateKeyPkcs1Pem, 'the-passphrase');

      assert.ok(encrypted.startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----'));
      assert.doesNotThrow(() => crypto.createPrivateKey({ key: encrypted, format: 'pem', passphrase: 'the-passphrase' }));
    });

    it('fails to load with node crypto when the passphrase is wrong', () => {
      const encrypted = privateKeyToEncryptedPkcs8Pem(privateKeyPkcs1Pem, 'the-passphrase');

      assert.throws(() => crypto.createPrivateKey({ key: encrypted, format: 'pem', passphrase: 'wrong-passphrase' }));
    });
  });
});
