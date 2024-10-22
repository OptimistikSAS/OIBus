import { BaseEntity, Instant } from './types';
import { RegistrationStatus } from '../../../shared/model/engine.model';

export interface OIAnalyticsRegistration extends BaseEntity {
  host: string;
  activationCode: string | null;
  token: string | null;
  publicCipherKey: string | null;
  privateCipherKey: string | null;
  status: RegistrationStatus;
  activationDate: Instant;
  activationExpirationDate?: Instant;
  checkUrl: string | null;
  useProxy: boolean;
  proxyUrl: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  acceptUnauthorized: boolean;
}

export interface OIAnalyticsRegistrationEditCommand {
  host: string;
  useProxy: boolean;
  proxyUrl: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  acceptUnauthorized: boolean;
}
