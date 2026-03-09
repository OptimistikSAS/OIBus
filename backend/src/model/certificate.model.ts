import { BaseEntity } from './types';
import { Instant } from '../../shared/model/types';

export interface Certificate extends BaseEntity {
  name: string;
  description: string;
  publicKey: string;
  privateKey: string;
  certificate: string;
  expiry: Instant;
}
