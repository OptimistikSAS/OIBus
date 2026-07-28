import { BaseEntity } from './types';
import { Instant } from '../../shared/model/types';

export interface Certificate extends BaseEntity {
  name: string;
  description: string;
  publicKey: string;
  privateKey: string;
  certificate: string;
  certificateChain: string | null;
  expiry: Instant;
}

export interface CertificateImportCommand {
  name: string;
  description: string;
  certificateContent: Buffer;
  privateKeyContent: Buffer;
  privateKeyPassphrase: string | null;
  certificateChainContent: Buffer | null;
}
