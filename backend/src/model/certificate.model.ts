import { Instant } from '../../shared/model/common/types';

import { BaseEntity } from './types';

export interface Certificate extends BaseEntity {
  name: string;
  description: string;
  publicKey: string;
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
 * What uses a certificate of the store: a connector, a history query or the web server (HTTPS)
 */
export interface CertificateUsage {
  type: 'south' | 'north' | 'history-query' | 'web-server';
  name: string;
}

export interface CertificateImportCommand {
  name: string;
  description: string;
  certificateContent: Buffer;
  privateKeyContent: Buffer;
  privateKeyPassphrase: string | null;
  certificateChainContent: Buffer | null;
}
