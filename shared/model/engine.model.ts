import { BaseEntity, Instant } from './types';

export const SCOPE_TYPES = ['south', 'north', 'history-query', 'internal', 'web-server'];
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
type ConsoleLogSettings = BaseLogSettings;

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
  username: string;
  password: string;
}

/**
 * Settings to write logs into a remote loki instance
 */
interface OiaLogSettings extends BaseLogSettings {
  interval: number;
}

/**
 * Logs settings used in the engine
 */
export interface LogSettings {
  console: ConsoleLogSettings;
  file: FileLogSettings;
  database: DatabaseLogSettings;
  loki: LokiLogSettings;
  oia: OiaLogSettings;
}

/**
 * Engine settings DTO
 */
export interface EngineSettingsDTO extends BaseEntity {
  name: string;
  port: number;
  version: string;
  proxyEnabled: boolean;
  proxyPort: number;
  logParameters: LogSettings;
}

export const REGISTRATION_STATUS = ['NOT_REGISTERED', 'PENDING', 'REGISTERED'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number];

/**
 * Registration settings DTO
 */
export interface RegistrationSettingsDTO extends BaseEntity {
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

export interface RegistrationSettingsCommandDTO {
  host: string;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  acceptUnauthorized: boolean;
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
  proxyEnabled: boolean;
  proxyPort: number;
  logParameters: LogSettings;
}

export interface OIBusError {
  retry: boolean;
  message: string;
}

export interface OIBusInfo {
  version: string;
  oibusName: string;
  oibusId: string;
  dataDirectory: string;
  binaryDirectory: string;
  processId: string;
  hostname: string;
  operatingSystem: string;
  architecture: string;
  platform: string;
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
  lastValueSent: OIBusTimeValue | null;
  lastFileSent: string | null;
  cacheSize: number;
}

export interface SouthHistoryMetrics {
  running?: boolean;
  // Percentage of the current interval that has been processed [0,1]
  intervalProgress?: number;
  // Start of the current interval
  currentIntervalStart?: Instant;
  // End of the current interval
  currentIntervalEnd?: Instant;
  // Number of the current interval
  currentIntervalNumber?: number;
  // Maximum number of intervals
  numberOfIntervals?: number;
}

export interface SouthConnectorMetrics extends BaseConnectorMetrics {
  numberOfValuesRetrieved: number;
  numberOfFilesRetrieved: number;
  lastValueRetrieved: OIBusTimeValue | null;
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

interface BaseOIBusContent {
  type: string;
}

export interface OIBusTimeValue {
  pointId: string;
  timestamp: Instant;
  data: {
    value: string | number;
    [key: string]: any;
  };
}

// OIBusTimeValueContent is currently called OIBusDataValue
export interface OIBusTimeValueContent extends BaseOIBusContent {
  type: 'time-values';
  content: Array<OIBusTimeValue>;
}

export interface OIBusRawContent extends BaseOIBusContent {
  type: 'raw';
  filePath: string;
  content?: string;
}

export type OIBusContent = OIBusTimeValueContent | OIBusRawContent;
