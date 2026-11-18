import { RegistrationCommandPermissions, RegistrationStatus } from '../../shared/model/domain/engine.model';

import { BaseEntity, Instant } from './types';

export interface OIAnalyticsRegistration extends BaseEntity {
  host: string;
  activationCode: string | null;
  /** Encrypted access token */
  token: string | null;
  /** Encrypted refresh token, null for a registration made before the tokens could be refreshed */
  refreshToken: string | null;
  tokenExpirationDate: Instant | null;
  refreshTokenExpirationDate: Instant | null;
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
  useApiGateway: boolean;
  apiGatewayHeaderKey: string | null;
  apiGatewayHeaderValue: string | null;
  apiGatewayBaseEndpoint: string | null;
  acceptUnauthorized: boolean;
  commandRefreshInterval: number;
  commandRetryInterval: number;
  messageRetryInterval: number;
  commandPermissions: RegistrationCommandPermissions;
}

export interface OIAnalyticsRegistrationEditCommand {
  host: string;
  useProxy: boolean;
  proxyUrl: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  useApiGateway: boolean;
  apiGatewayHeaderKey: string | null;
  apiGatewayHeaderValue: string | null;
  apiGatewayBaseEndpoint: string | null;
  acceptUnauthorized: boolean;
  commandRefreshInterval: number;
  commandRetryInterval: number;
  messageRetryInterval: number;
  commandPermissions: RegistrationCommandPermissions;
}

/**
 * The tokens OIAnalytics issues on registration, refresh or exchange, with their expiration dates computed by OIBus when
 * it receives them. The tokens are encrypted. An OIAnalytics which can't refresh tokens yet only issues a long-lived
 * access token: the other fields are then null.
 */
export interface OIAnalyticsRegistrationTokens {
  token: string;
  refreshToken: string | null;
  tokenExpirationDate: Instant | null;
  refreshTokenExpirationDate: Instant | null;
}
