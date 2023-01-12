export const AUTHENTICATION_TYPES = ["none", "basic", "bearer", "api-key"];
export type AuthenticationType = typeof AUTHENTICATION_TYPES[number];

interface Authentication {
  type: AuthenticationType;
  key: string;
  secret: string;
}

export const LOG_LEVELS = [
  "silent",
  "error",
  "warning",
  "info",
  "debug",
  "trace",
];
export type LogLevel = typeof LOG_LEVELS[number];

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
  proxyId: string | null;
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
 * Log settings for Health Signal
 */
interface HealthSignalLoggingDTO {
  enabled: boolean;
  interval: number;
}

/**
 * HTTP settings for Health Signal
 */
interface HealthSignalHTTPDTO {
  enabled: boolean;
  interval: number;
  verbose: boolean;
  address: string;
  proxyId: string | null;
  authentication: Authentication;
}

/**
 * DTO for health signal settings
 */
export interface HealthSignalDTO {
  logging: HealthSignalLoggingDTO;
  http: HealthSignalHTTPDTO;
}

/**
 * Engine settings DTO
 */
export interface EngineSettingsDTO {
  id: string;
  name: string;
  port: number;
  logParameters: LogSettings;
  healthSignal: HealthSignalDTO;
}

/**
 * Engine settings command DTO
 */
export interface EngineSettingsCommandDTO {
  name: string;
  port: number;
  logParameters: LogSettings;
  healthSignal: HealthSignalDTO;
}
