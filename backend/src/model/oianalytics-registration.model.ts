import { BaseEntity, Instant } from './types';
import { RegistrationStatus } from '../../../shared/model/engine.model';

export interface OIAnalyticsRegistration extends BaseEntity {
  host: string;
  activationCode?: string;
  token?: string;
  status: RegistrationStatus;
  activationDate: Instant;
  activationExpirationDate?: Instant;
  checkUrl?: string;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  acceptUnauthorized: boolean;
}

export interface OIAnalyticsRegistrationEditCommand {
  host: string;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  acceptUnauthorized: boolean;
}
