import { RegistrationCommandPermissions, RegistrationStatus } from '../../shared/model/domain/engine.model';

import { BaseEntity, Instant } from './types';

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
