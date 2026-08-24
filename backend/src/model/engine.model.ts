import { BaseEntity } from './types';
import { LogLevel } from '../../shared/model/logs.model';
import { AuthTokenDuration } from '../../shared/model/engine.model';

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
