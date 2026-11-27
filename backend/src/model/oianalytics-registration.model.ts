import { RegistrationCommandPermissions, RegistrationStatus } from '../../shared/model/domain/engine.model';
import { ServerCertificateValidation } from '../../shared/model/domain/server-identity.model';

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
  /** Encrypted private key */
  privateCipherKey: string | null;
  /**
   * Encrypted private key replaced by the last key rotation, to decrypt the secrets OIAnalytics encrypted with the
   * previous public key before it received the new one
   */
  previousPrivateCipherKey: string | null;
  /**
   * When the key pair must be replaced: when the refresh token issued with it would have expired. Null when it must be
   * replaced at the next refresh (key pair of a registration made before the tokens could be refreshed).
   */
  cipherKeyRotationDate: Instant | null;
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
  /** How the certificate of OIAnalytics is validated */
  certificateValidation: ServerCertificateValidation;
  /** The trusted certificate of the store the certificate of OIAnalytics is validated against */
  trustedCertificateId: string | null;
  /**
   * Whether the certificate OIAnalytics presents at the next connection is trusted (added to the store and selected), while
   * none is selected: a registration which accepted any certificate before
   */
  trustOnFirstUse: boolean;
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
  /** How the certificate of OIAnalytics is validated */
  certificateValidation: ServerCertificateValidation;
  /** The trusted certificate of the store the certificate of OIAnalytics is validated against */
  trustedCertificateId: string | null;
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
