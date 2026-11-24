import { Instant } from '../common/types';
import { ServerIdentityType } from '../connector/server-identity-type.model';

/**
 * What an X.509 certificate presented by a server says about it, to be compared with the server before trusting it.
 */
export interface X509ServerIdentityDetails {
  /**
   * The distinguished name of the subject, one attribute per line.
   * @example "CN=My OPC UA Server\nO=Optimistik"
   */
  subject: string;

  /**
   * The distinguished name of the issuer, one attribute per line.
   * @example "CN=My OPC UA Server\nO=Optimistik"
   */
  issuer: string;

  /**
   * The serial number, in hexadecimal.
   * @example "5E2A0C"
   */
  serialNumber: string;

  /**
   * The start of the validity period.
   * @example "2026-01-01T00:00:00.000Z"
   */
  validFrom: Instant;

  /**
   * The end of the validity period.
   * @example "2027-01-01T00:00:00.000Z"
   */
  validTo: Instant;

  /**
   * The URIs of the subject alternative names (the application URI of an OPC UA server).
   * @example ["urn:my-server:UA:Server"]
   */
  uris: Array<string>;

  /**
   * The DNS names of the subject alternative names.
   * @example ["my-server.local"]
   */
  dnsNames: Array<string>;

  /**
   * The IP addresses of the subject alternative names.
   * @example ["192.168.0.10"]
   */
  ipAddresses: Array<string>;

  /**
   * Whether the certificate is self-signed, rather than issued by a certificate authority.
   * @example true
   */
  selfSigned: boolean;
}

/**
 * What the host key presented by an SSH server says about it.
 */
export interface SshHostKeyServerIdentityDetails {
  /**
   * The algorithm of the key.
   * @example "ssh-ed25519"
   */
  keyType: string;
}

/**
 * The identity a server presents to a connector: what a user trusts, and what the connector compares at each connection.
 */
export interface ServerIdentity {
  /**
   * The kind of identity.
   * @example "x509"
   */
  type: ServerIdentityType;

  /**
   * The SHA-256 fingerprint, the only part compared at each connection, in the format of the tools of its kind, to be
   * compared with the server: colon-separated hexadecimal for a certificate, `SHA256:` followed by base64 for an SSH host
   * key (as `ssh-keygen -l` shows it).
   * @example "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89"
   */
  fingerprint: string;

  /**
   * What the identity says about the server, depending on its type.
   */
  details: X509ServerIdentityDetails | SshHostKeyServerIdentityDetails;
}

/**
 * An identity trusted for a connector, with who trusted it and when.
 */
export interface TrustedServerIdentity extends ServerIdentity {
  /**
   * The user who trusted the identity: `system` for an identity trusted at the first connection after an upgrade.
   * @example "admin"
   */
  trustedBy: string;

  /**
   * When the identity was trusted.
   * @example "2026-01-01T00:00:00.000Z"
   */
  trustedAt: Instant;
}

/**
 * How the identity a server presents compares with the trusted one:
 * - `trusted`: it is the trusted identity
 * - `unknown`: no identity is trusted yet
 * - `changed`: it is not the trusted identity (a renewed certificate, or another server)
 */
export const SERVER_IDENTITY_TRUST_STATUSES = ['trusted', 'unknown', 'changed'] as const;

/**
 * How the identity a server presents compares with the trusted one.
 *
 * @example 'unknown'
 */
export type ServerIdentityTrustStatus = (typeof SERVER_IDENTITY_TRUST_STATUSES)[number];

/**
 * The identity a server presented, and how it compares with the trusted one.
 */
export interface PresentedServerIdentity {
  /**
   * The identity the server presented.
   */
  identity: ServerIdentity;

  /**
   * How it compares with the trusted identity.
   * @example "changed"
   */
  status: ServerIdentityTrustStatus;
}

/**
 * The trust of a connector in the identity of its server.
 */
export interface ServerTrust {
  /**
   * The identity trusted, `null` when none is.
   */
  identity: TrustedServerIdentity | null;

  /**
   * Whether the connector trusts the identity it receives at its next connection, when none is trusted: set on the
   * connectors which worked before the identity of their server was checked, so that their connection keeps working.
   * @example false
   */
  trustOnFirstUse: boolean;
}

/**
 * The trust of a connector in the identity of its server, with the identity its server presented when the connector refused
 * it.
 */
export interface ServerTrustState extends ServerTrust {
  /**
   * The identity the server presented at the last connection the connector refused, `null` when it did not refuse any.
   */
  pending: PresentedServerIdentity | null;
}
