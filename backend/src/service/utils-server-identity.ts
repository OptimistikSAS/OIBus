import crypto from 'node:crypto';

import { Instant } from '../../shared/model/common/types';
import {
  ServerIdentity,
  ServerIdentityTrustStatus,
  ServerTrust,
  TrustedServerIdentity
} from '../../shared/model/domain/server-identity.model';

/** The trust of a connector which trusts no identity, and does not trust the first one it receives. */
export const NO_SERVER_TRUST: ServerTrust = Object.freeze({ identity: null, trustOnFirstUse: false });

/**
 * The subject alternative names of a certificate, as Node shows them (`DNS:host, URI:urn:..., IP Address:10.0.0.1`), a
 * value being quoted as a JSON string when it holds a comma or a quote.
 */
const parseSubjectAltName = (
  subjectAltName: string | undefined
): { uris: Array<string>; dnsNames: Array<string>; ipAddresses: Array<string> } => {
  const names = { uris: [] as Array<string>, dnsNames: [] as Array<string>, ipAddresses: [] as Array<string> };
  for (const match of (subjectAltName ?? '').matchAll(/(DNS|URI|IP Address):("(?:[^"\\]|\\.)*"|[^,]*)/g)) {
    const value = match[2].startsWith('"') ? (JSON.parse(match[2]) as string) : match[2].trim();
    if (match[1] === 'DNS') names.dnsNames.push(value);
    else if (match[1] === 'URI') names.uris.push(value);
    else names.ipAddresses.push(value);
  }
  return names;
};

const isSelfSigned = (certificate: crypto.X509Certificate): boolean => {
  try {
    return certificate.checkIssued(certificate) && certificate.verify(certificate.publicKey);
  } catch {
    return false;
  }
};

/**
 * The identity of a server presenting this X.509 certificate (DER). With a chain, the identity is the one of its first
 * certificate, the certificate of the server.
 */
export const toX509ServerIdentity = (certificate: Buffer): ServerIdentity => {
  const x509 = new crypto.X509Certificate(certificate);
  return {
    type: 'x509',
    fingerprint: x509.fingerprint256,
    details: {
      subject: x509.subject,
      issuer: x509.issuer,
      serialNumber: x509.serialNumber,
      validFrom: x509.validFromDate.toISOString(),
      validTo: x509.validToDate.toISOString(),
      ...parseSubjectAltName(x509.subjectAltName),
      selfSigned: isSelfSigned(x509)
    }
  };
};

/**
 * The identity of an SSH server presenting this host key, in the SSH wire format (a string naming the algorithm, then the
 * key). Its fingerprint is the one `ssh-keygen -l` shows.
 */
export const toSshHostKeyServerIdentity = (hostKey: Buffer): ServerIdentity => {
  const keyTypeLength = hostKey.length >= 4 ? hostKey.readUInt32BE(0) : 0;
  const keyType =
    keyTypeLength > 0 && keyTypeLength <= hostKey.length - 4 ? hostKey.subarray(4, 4 + keyTypeLength).toString('ascii') : 'unknown';
  return {
    type: 'ssh-host-key',
    fingerprint: `SHA256:${crypto.createHash('sha256').update(hostKey).digest('base64').replace(/=+$/, '')}`,
    details: { keyType }
  };
};

/**
 * Whether two fingerprints are the same, in the format of their type: an SSH fingerprint (`SHA256:` then base64, which is
 * case-sensitive) exactly, a certificate fingerprint (hexadecimal) whatever its case and separators.
 */
export const sameFingerprint = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) {
    return false;
  }
  if (a.startsWith('SHA256:') || b.startsWith('SHA256:')) {
    return a === b;
  }
  const toHex = (fingerprint: string) => fingerprint.replace(/[^0-9a-f]/gi, '').toUpperCase();
  return toHex(a) === toHex(b);
};

/**
 * How an identity presented by a server compares with the trusted one: only the type and the fingerprint are compared,
 * the details being what the server says about itself.
 */
export const getServerIdentityTrustStatus = (presented: ServerIdentity, trusted: ServerIdentity | null): ServerIdentityTrustStatus => {
  if (!trusted) {
    return 'unknown';
  }
  return trusted.type === presented.type && sameFingerprint(trusted.fingerprint, presented.fingerprint) ? 'trusted' : 'changed';
};

/** The identity, trusted by a user (or `system`) at a given time. */
export const toTrustedServerIdentity = (identity: ServerIdentity, trustedBy: string, trustedAt: Instant): TrustedServerIdentity => ({
  type: identity.type,
  fingerprint: identity.fingerprint,
  details: identity.details,
  trustedBy,
  trustedAt
});

/** How an identity is named in the logs. */
export const describeServerIdentity = (identity: ServerIdentity): string =>
  `${identity.type === 'x509' ? 'certificate' : 'host key'} ${identity.fingerprint}`;
