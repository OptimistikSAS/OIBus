import { BaseEntity, Instant } from './types';

/**
 * Data Transfer Object for a certificate.
 * Represents a certificate with its metadata, public key, and expiry information.
 *
 * @example
 * {
 *   "id": "aBc12F",
 *   "name": "Server SSL Certificate",
 *   "description": "SSL certificate for securing server communications",
 *   "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
 *   "certificate": "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBBQUAMEUx...",
 *   "expiry": "2024-12-31T23:59:59Z",
 *   "createdAt": "2023-01-01T00:00:00Z",
 *   "updatedAt": "2023-01-01T00:00:00Z"
 * }
 */
export interface CertificateDTO extends BaseEntity {
  /**
   * The name of the certificate.
   * @example "Server SSL Certificate"
   */
  name: string;

  /**
   * A description of the certificate's purpose or usage.
   * @example "SSL certificate for securing server communications"
   */
  description: string;

  /**
   * The public key of the certificate in PEM format.
   * @example "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
   */
  publicKey: string;

  /**
   * The certificate in PEM format.
   * @example "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBBQUAMEUx..."
   */
  certificate: string;

  /**
   * The expiry date and time of the certificate.
   * @example "2024-12-31T23:59:59Z"
   */
  expiry: Instant;
}

/**
 * Command DTO for creating or updating a certificate.
 * Used as the request body for certificate creation/update endpoints.
 *
 * @example
 * {
 *   "name": "New Server SSL Certificate",
 *   "description": "New SSL certificate for securing server communications",
 *   "regenerateCertificate": false,
 *   "options": {
 *     "commonName": "example.com",
 *     "countryName": "US",
 *     "stateOrProvinceName": "California",
 *     "localityName": "San Francisco",
 *     "organizationName": "Example Inc.",
 *     "keySize": 2048,
 *     "daysBeforeExpiry": 365
 *   }
 * }
 */
export interface CertificateCommandDTO {
  /**
   * The name of the certificate.
   * @example "New Server SSL Certificate"
   */
  name: string;

  /**
   * A description of the certificate's purpose or usage.
   * @example "New SSL certificate for securing server communications"
   */
  description: string;

  /**
   * Whether to regenerate the certificate.
   * @example false
   */
  regenerateCertificate: boolean;

  /**
   * Options for generating the certificate.
   * Set to `null` to not regenerate certificate
   * @example
   * {
   *   "commonName": "example.com",
   *   "countryName": "US",
   *   "stateOrProvinceName": "California",
   *   "localityName": "San Francisco",
   *   "organizationName": "Example Inc.",
   *   "keySize": 2048,
   *   "daysBeforeExpiry": 365
   * }
   */
  options: CertificateOptions | null;
}

/**
 * Options for generating a certificate.
 * Used to specify details for certificate generation.
 *
 * @example
 * {
 *   "commonName": "example.com",
 *   "countryName": "US",
 *   "stateOrProvinceName": "California",
 *   "localityName": "San Francisco",
 *   "organizationName": "Example Inc.",
 *   "keySize": 2048,
 *   "daysBeforeExpiry": 365
 * }
 */
export interface CertificateOptions {
  /**
   * The common name (e.g., domain name) for the certificate.
   * @example "example.com"
   */
  commonName: string;

  /**
   * The country name for the certificate.
   * @example "US"
   */
  countryName: string;

  /**
   * The state or province name for the certificate.
   * @example "California"
   */
  stateOrProvinceName: string;

  /**
   * The locality (e.g., city) name for the certificate.
   * @example "San Francisco"
   */
  localityName: string;

  /**
   * The organization name for the certificate.
   * @example "Example Inc."
   */
  organizationName: string;

  /**
   * The key size in bits for the certificate.
   * @example 2048
   */
  keySize: number;

  /**
   * The number of days before the certificate expires.
   * @example 365
   */
  daysBeforeExpiry: number;
}
