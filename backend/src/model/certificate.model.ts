import { Instant } from '../../shared/model/common/types';
import { CertificateKind } from '../../shared/model/domain/certificate.model';

import { BaseEntity } from './types';

export interface Certificate extends BaseEntity {
  name: string;
  description: string;
  /**
   * Whether OIBus presents the certificate (`key-pair`) or trusts it (`trusted`)
   */
  kind: CertificateKind;
  publicKey: string;
  /**
   * The private key, encrypted: empty for a trusted certificate, and for a certificate imported from a configuration file
   */
  privateKey: string;
  certificate: string;
  certificateChain: string | null;
  expiry: Instant;
}

/**
 * A certificate of the store with its private key decrypted, to authenticate with it
 */
export interface CertificateKeyPair {
  name: string;
  certificate: string;
  certificateChain: string | null;
  privateKey: string;
}

/**
 * What uses a certificate of the store: a connector, a history query, the web server (HTTPS) or the registration of OIBus
 * with OIAnalytics (validating the certificate of OIAnalytics)
 */
export interface CertificateUsage {
  type: 'south' | 'north' | 'history-query' | 'web-server' | 'registration';
  name: string;
}

export interface CertificateImportCommand {
  name: string;
  description: string;
  certificateContent: Buffer;
  /**
   * The private key of the certificate, `null` to import a trusted certificate (a certification authority, or the
   * certificate of a server)
   */
  privateKeyContent: Buffer | null;
  privateKeyPassphrase: string | null;
  certificateChainContent: Buffer | null;
}
