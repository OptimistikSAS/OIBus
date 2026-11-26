/**
 * The kinds of certificates of the store:
 * - `key-pair`: a certificate OIBus presents, with its private key (HTTPS, OPC UA application and user certificates)
 * - `trusted`: a certificate OIBus trusts, without private key: a certification authority, or the certificate of a server
 *   trusted as is (self-signed...), which the certificate a server presents is validated against
 */
export const CERTIFICATE_KINDS = ['key-pair', 'trusted'] as const;

/**
 * The kind of a certificate of the store.
 * @example "trusted"
 */
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];
