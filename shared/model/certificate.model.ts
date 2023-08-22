import { BaseEntity, Instant } from './types';

export interface Certificate extends BaseEntity {
  name: string;
  description: string;
  publicKey: string;
  privateKey: string;
  certificate: string;
  expiry: Instant;
}

export interface CertificateDTO extends BaseEntity {
  name: string;
  description: string;
  publicKey: string;
  certificate: string;
  expiry: Instant;
}

export interface CertificateCommandDTO {
  name: string;
  description: string;
  regenerateCertificate: boolean;
  options: CertificateOptions | null;
}

export interface CertificateOptions {
  commonName: string;
  countryName: string;
  stateOrProvinceName: string;
  localityName: string;
  organizationName: string;
  keySize: number;
  daysBeforeExpiry: number;
}
