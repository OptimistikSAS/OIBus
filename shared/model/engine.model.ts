import { BaseEntity, Instant } from './types';

export const SCOPE_TYPES = ['south', 'north', 'data-stream', 'history-engine', 'history-query', 'web-server', 'logger-service'];
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug', 'trace'];
export type LogLevel = (typeof LOG_LEVELS)[number];

export const AUTHENTICATION_TYPES = ['none', 'basic', 'bearer', 'api-key', 'cert'];
export type AuthenticationType = (typeof AUTHENTICATION_TYPES)[number];

/**
 * Base settings for log parameters
 */
interface BaseLogSettings {
  level: LogLevel;
}

/**
 * Settings to write logs into console
 */
interface ConsoleLogSettings extends BaseLogSettings {}

/**
 * Settings to write logs into files
 */
interface FileLogSettings extends BaseLogSettings {
  maxFileSize: number;
  numberOfFiles: number;
}

/**
 * Settings to write logs into a locale database
 */
interface DatabaseLogSettings extends BaseLogSettings {
  maxNumberOfLogs: number;
}

/**
 * Settings to write logs into a remote loki instance
 */
interface LokiLogSettings extends BaseLogSettings {
  interval: number;
  address: string;
  tokenAddress: string;
  username: string;
  password: string;
}

/**
 * Logs settings used in the engine
 */
export interface LogSettings {
  console: ConsoleLogSettings;
  file: FileLogSettings;
  database: DatabaseLogSettings;
  loki: LokiLogSettings;
}

/**
 * Engine settings DTO
 */
export interface EngineSettingsDTO extends BaseEntity {
  name: string;
  port: number;
  logParameters: LogSettings;
}

export interface CryptoSettings {
  algorithm: string;
  initVector: string;
  securityKey: string;
}

/**
 * Engine settings command DTO
 */
export interface EngineSettingsCommandDTO {
  name: string;
  port: number;
  logParameters: LogSettings;
}

export interface OIBusError {
  retry: boolean;
  message: string;
}

export interface OIBusInfo {
  version: string;
  dataDirectory: string;
  binaryDirectory: string;
  processId: string;
  hostname: string;
  operatingSystem: string;
  architecture: string;
}

export interface BaseConnectorMetrics {
  metricsStart: Instant;
  lastConnection: Instant | null;
  lastRunStart: Instant | null;
  lastRunDuration: number | null;
}

export interface NorthConnectorMetrics extends BaseConnectorMetrics {
  numberOfValuesSent: number;
  numberOfFilesSent: number;
  lastValueSent: OIBusDataValue | null;
  lastFileSent: string | null;
  cacheSize: number;
}

export interface SouthHistoryMetrics {}

export interface SouthConnectorMetrics extends BaseConnectorMetrics {
  numberOfValuesRetrieved: number;
  numberOfFilesRetrieved: number;
  lastValueRetrieved: OIBusDataValue | null;
  lastFileRetrieved: string | null;
  historyMetrics: SouthHistoryMetrics;
}

export interface HistoryMetrics {
  north: NorthConnectorMetrics;
  south: SouthConnectorMetrics;
}

export interface EngineMetrics {
  metricsStart: Instant;
  processCpuUsageInstant: number;
  processCpuUsageAverage: number;
  processUptime: number;
  freeMemory: number;
  totalMemory: number;
  minRss: number;
  currentRss: number;
  maxRss: number;
  minHeapTotal: number;
  currentHeapTotal: number;
  maxHeapTotal: number;
  minHeapUsed: number;
  currentHeapUsed: number;
  maxHeapUsed: number;
  minExternal: number;
  currentExternal: number;
  maxExternal: number;
  minArrayBuffers: number;
  currentArrayBuffers: number;
  maxArrayBuffers: number;
}

export interface HomeMetrics {
  norths: Record<string, NorthConnectorMetrics>;
  engine: EngineMetrics;
  souths: Record<string, SouthConnectorMetrics>;
}

export interface OIBusDataValue {
  pointId: string;
  timestamp: Instant;
  data: {
    value: string;
    [key: string]: any;
  };
}
