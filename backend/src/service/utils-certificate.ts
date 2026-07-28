import * as forge from 'node-forge';
import { DateTime } from 'luxon';
import { OIBusValidationError } from '../model/types';
import { Instant } from '../../shared/model/types';

const PEM_CERT_HEADER = '-----BEGIN CERTIFICATE-----';

const toForgeBuffer = (content: Buffer) => forge.util.createBuffer(content.toString('binary'));

/**
 * Accepts a PEM or DER certificate file content and normalises it to PEM.
 */
export const certificateContentToPem = (content: Buffer): string => {
  const text = content.toString('utf8');
  if (text.includes(PEM_CERT_HEADER)) {
    return text;
  }
  try {
    return forge.pki.certificateToPem(forge.pki.certificateFromAsn1(forge.asn1.fromDer(toForgeBuffer(content))));
  } catch (error) {
    throw new OIBusValidationError(`Unable to parse the certificate: ${(error as Error).message}`);
  }
};

/**
 * Splits a PEM bundle into individual certificate PEMs (leaf first).
 */
export const splitPemChain = (pem: string): Array<string> =>
  pem
    .split(PEM_CERT_HEADER)
    .filter(part => part.trim() !== '')
    .map(part => `${PEM_CERT_HEADER}${part}`.trim());

export const certificatePemToDer = (pem: string): Buffer =>
  Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(forge.pki.certificateFromPem(pem))).getBytes(), 'binary');

export interface ParsedCertificate {
  pem: string;
  publicKeyPem: string;
  expiry: Instant;
}

/**
 * Parses a PEM certificate, asserts it is RSA, and extracts its public key and real notAfter.
 */
export const readCertificate = (pem: string): ParsedCertificate => {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(pem);
  } catch (error) {
    throw new OIBusValidationError(`Unable to parse the certificate: ${(error as Error).message}`);
  }

  // forge.pki is RSA-only: certificates using another key algorithm won't expose n/e on their public key
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  if (!('n' in publicKey) || !('e' in publicKey)) {
    throw new OIBusValidationError('Only RSA certificates are supported');
  }

  return {
    // re-serialise so that a bundle uploaded as the leaf is reduced to its first certificate
    pem: forge.pki.certificateToPem(cert),
    publicKeyPem: forge.pki.publicKeyToPem(publicKey),
    expiry: DateTime.fromJSDate(cert.validity.notAfter).toUTC().toISO()!
  };
};

/**
 * PEM (PKCS#1 / PKCS#8 / encrypted) or DER key content -> canonical PKCS#1 PEM (the at-rest format).
 */
export const privateKeyContentToPem = (content: Buffer, passphrase: string | null): string => {
  const text = content.toString('utf8');
  if (text.includes('-----BEGIN')) {
    if (text.includes('ENCRYPTED PRIVATE KEY') || text.includes('DEK-Info')) {
      if (!passphrase) {
        throw new OIBusValidationError('The private key is encrypted: a passphrase is required');
      }
      // a wrong passphrase either returns null or makes forge throw while parsing the garbage plaintext
      let key: forge.pki.rsa.PrivateKey | null;
      try {
        key = forge.pki.decryptRsaPrivateKey(text, passphrase);
      } catch {
        key = null;
      }
      if (!key) {
        throw new OIBusValidationError('Unable to decrypt the private key: wrong passphrase or unsupported algorithm');
      }
      return forge.pki.privateKeyToPem(key);
    }
    try {
      return forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(text));
    } catch (error) {
      throw new OIBusValidationError(`Unable to parse the private key: ${(error as Error).message}`);
    }
  }

  try {
    return forge.pki.privateKeyToPem(forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(toForgeBuffer(content))));
  } catch (error) {
    throw new OIBusValidationError(`Unable to parse the private key: ${(error as Error).message}`);
  }
};

export const assertKeyMatchesCertificate = (certificatePem: string, privateKeyPem: string): void => {
  const key = forge.pki.privateKeyFromPem(privateKeyPem);
  const derived = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(key.n, key.e));
  if (derived !== readCertificate(certificatePem).publicKeyPem) {
    throw new OIBusValidationError('The private key does not match the certificate public key');
  }
};

/**
 * Passphrase-protected PKCS#8 PEM ("BEGIN ENCRYPTED PRIVATE KEY"), PBES2 / PBKDF2-HMAC-SHA256 / AES-256-CBC.
 */
export const privateKeyToEncryptedPkcs8Pem = (privateKeyPem: string, passphrase: string): string => {
  const info = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(forge.pki.privateKeyFromPem(privateKeyPem)));
  return forge.pki.encryptedPrivateKeyToPem(
    forge.pki.encryptPrivateKeyInfo(info, passphrase, { algorithm: 'aes256', count: 100_000, saltSize: 16, prfAlgorithm: 'sha256' })
  );
};
