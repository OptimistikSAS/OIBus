import { SouthItemSettings } from '../../shared/model/connector/south-settings.model';
import { AuthTokenDuration } from '../../shared/model/domain/engine.model';
import { LogLevel } from '../../shared/model/domain/logs.model';

import { HistoryQueryItemEntity } from './histor-query.model';
import { SouthConnectorItemEntity } from './south-connector.model';
import { BaseEntity, Instant } from './types';

export interface EngineSettings extends BaseEntity {
  version: string;
  launcherVersion: string;
  auditRetentionDuration: number | null;
  general: {
    name: string;
  };
  webServer: {
    port: number;
    authTokenDuration: AuthTokenDuration;
  };
  proxyServer: {
    enabled: boolean;
    port: number | null;
    username: string | null;
    password: string | null;
    forward: {
      enabled: boolean;
      url: string | null;
      username: string | null;
      password: string | null;
    };
  };
  logger: {
    console: {
      level: LogLevel;
    };
    file: {
      level: LogLevel;
      maxFileSize: number;
      numberOfFiles: number;
    };
    database: {
      level: LogLevel;
      maxNumberOfLogs: number;
    };
    loki: {
      level: LogLevel;
      interval: number;
      address: string;
      username: string;
      password: string;
    };
    oia: {
      level: LogLevel;
      interval: number;
    };
    syslog: {
      level: LogLevel;
      host: string;
      port: number;
      protocol: 'udp4' | 'tcp';
    };
  };
}

/*
 * What the engine repository persists for each settings section. Built by OIBusService from the API commands:
 * secrets are already encrypted (hashed for the proxy password) or carried over from the current settings, and
 * values the API lets callers omit are explicit nulls.
 */
export type EngineWebServerCommand = EngineSettings['webServer'];

export type EngineProxyCommand = EngineSettings['proxyServer'];

export interface EngineLoggerCommand {
  auditRetentionDuration: number | null;
  console: { level: LogLevel };
  file: { level: LogLevel; maxFileSize: number; numberOfFiles: number };
  database: { level: LogLevel; maxNumberOfLogs: number };
  loki: { level: LogLevel; interval: number; address: string | null; username: string | null; password: string | null };
  oia: { level: LogLevel; interval: number };
  syslog: { level: LogLevel; host: string | null; port: number; protocol: 'udp4' | 'tcp' };
}

export interface EngineSettingsCommand {
  auditRetentionDuration: number | null;
  general: EngineSettings['general'];
  webServer: EngineWebServerCommand;
  proxyServer: EngineProxyCommand;
  logger: Omit<EngineLoggerCommand, 'auditRetentionDuration'>;
}

export class OIBusError extends Error {
  readonly _isOIBusError = true;
  constructor(
    message: string,
    readonly forceRetry: boolean
  ) {
    super(message);
  }
}

export interface CacheSize {
  cache: number;
  error: number;
  archive: number;
}

export const METADATA_FOLDER = 'metadata';
export const CONTENT_FOLDER = 'content';

export interface CacheMetadataSourceOriginSouth {
  source: 'south';

  /**
   * Datetime in iso format when the query has been triggered
   * @example "2023-01-01T00:00:00Z"
   */
  queryTime: Instant;

  /**
   * Start of the history query interval this content was retrieved from, if any (null for
   * subscription-based or direct-query content, which aren't bound to a time window).
   * @example "2023-01-01T00:00:00Z"
   */
  queryStartTime?: Instant | null;

  /**
   * End of the history query interval this content was retrieved from, if any.
   * @example "2023-01-01T01:00:00Z"
   */
  queryEndTime?: Instant | null;

  /**
   * ID of the south connector at the source of the data
   */
  southId: string;

  /**
   * Name of the south connector at the source of the data, substituted for `@ConnectorName` in
   * transformer filename patterns.
   */
  southName: string;

  /**
   * The items at the source of the data
   */
  items: Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>;
}

export interface CacheMetadataSourceOriginOIAnalytics {
  source: 'oianalytics-setpoints';
}

export interface CacheMetadataSourceOriginAPI {
  source: 'oibus-api';
  dataSourceId: string;
}

export interface CacheMetadataSourceOriginTest {
  source: 'test';
}

export type CacheMetadataSource =
  CacheMetadataSourceOriginSouth | CacheMetadataSourceOriginOIAnalytics | CacheMetadataSourceOriginAPI | CacheMetadataSourceOriginTest;
