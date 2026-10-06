import { BaseEntity, Instant } from '../common/types';
import {
  AuthTokenDuration,
  DataFolderType,
  EngineMetrics,
  NorthConnectorMetrics,
  RegistrationCommandPermissions,
  RegistrationStatus,
  SouthConnectorMetrics
} from '../domain/engine.model';
import { LogLevel } from '../domain/logs.model';

/**
 * Engine settings Data Transfer Object.
 * Represents the configuration settings for the engine.
 */
export interface EngineSettingsDTO extends BaseEntity {
  /**
   * The version of the engine.
   * @example "3.7.0"
   */
  version: string;

  /**
   * The version of the launcher.
   * @example "3.7.0"
   */
  launcherVersion: string;

  /**
   * Number of days audit log entries are kept before being pruned. `null` (or 0) means audit logs
   * are kept forever.
   * @example 90
   */
  auditRetentionDuration: number | null;

  /**
   * General engine settings.
   */
  general: {
    /**
     * The name of the engine.
     * @example "OIBus OT"
     */
    name: string;
  };

  /**
   * Web server settings.
   */
  webServer: {
    /**
     * The port on which the engine listens.
     * @example 2223
     */
    port: number;

    /**
     * The lifetime of an authentication token. One of AUTH_TOKEN_DURATIONS (jsonwebtoken `ms`-style duration string).
     * @example "7d"
     */
    authTokenDuration: AuthTokenDuration;
  };

  /**
   * Proxy server settings.
   */
  proxyServer: {
    /**
     * Whether the proxy is enabled.
     * @example false
     */
    enabled: boolean;

    /**
     * The port for the proxy, if enabled.
     * @example null
     */
    port: number | null;

    /**
     * Upstream forward proxy settings.
     */
    forward: {
      /**
       * Whether forwarding to an upstream proxy is enabled.
       * @example false
       */
      enabled: boolean;

      /**
       * The URL of the upstream proxy to forward requests through.
       * @example null
       */
      url: string | null;

      /**
       * The username for upstream proxy authentication.
       * @example null
       */
      username: string | null;

      /**
       * The password for upstream proxy authentication.
       * @example null
       */
      password: string | null;
    };

    /**
     * The username clients must use to authenticate with this proxy server. Null means no authentication required.
     * @example null
     */
    username: string | null;

    /**
     * The password clients must use to authenticate with this proxy server.
     * @example null
     */
    password: string | null;
  };

  /**
   * Logging parameters for different outputs.
   */
  logger: {
    /**
     * Console logging configuration.
     */
    console: {
      /**
       * The log level for console output.
       */
      level: LogLevel;
    };

    /**
     * File logging configuration.
     */
    file: {
      /**
       * The log level for file output.
       */
      level: LogLevel;

      /**
       * The maximum size of a log file in bytes.
       * @example 10485760
       */
      maxFileSize: number;

      /**
       * The number of log files to keep.
       * @example 5
       */
      numberOfFiles: number;
    };

    /**
     * Database logging configuration.
     */
    database: {
      /**
       * The log level for database output.
       */
      level: LogLevel;

      /**
       * The maximum number of logs to keep in the database.
       * @example 10000
       */
      maxNumberOfLogs: number;
    };

    /**
     * Loki logging configuration.
     */
    loki: {
      /**
       * The log level for Loki output.
       */
      level: LogLevel;

      /**
       * The interval in seconds for sending logs to Loki.
       * @example 60
       */
      interval: number;

      /**
       * The address of the Loki server.
       * @example "http://loki:3100"
       */
      address: string;

      /**
       * The username for Loki authentication.
       * @example "user"
       */
      username: string;

      /**
       * The password for Loki authentication.
       * @example "pass"
       */
      password: string;
    };

    /**
     * OIA logging configuration.
     */
    oia: {
      /**
       * The log level for OIA output.
       */
      level: LogLevel;

      /**
       * The interval in seconds for sending logs to OIA.
       * @example 60
       */
      interval: number;
    };

    /**
     * Syslog logging configuration.
     */
    syslog: {
      /**
       * The log level for syslog output.
       */
      level: LogLevel;

      /**
       * The hostname or IP of the syslog server. Empty string disables the transport.
       * @example "syslog.example.com"
       */
      host: string;

      /**
       * The port of the syslog server.
       * @example 514
       */
      port: number;

      /**
       * The transport protocol.
       * @example "udp4"
       */
      protocol: 'udp4' | 'tcp';
    };
  };
}

/**
 * Registration settings Data Transfer Object.
 * Represents the registration settings for the engine.
 */
export interface RegistrationSettingsDTO extends BaseEntity {
  /**
   * The host URL for registration.
   * @example "https://registration.example.com"
   */
  host: string;

  /**
   * The activation code for registration.
   * @example "ABC123"
   */
  activationCode: string | null;

  /**
   * The current registration status.
   * @example "REGISTERED"
   */
  status: RegistrationStatus;

  /**
   * The date and time when the activation occurred.
   * @example "2023-01-01T00:00:00Z"
   */
  activationDate: Instant;

  /**
   * The date and time when the activation expires.
   * @example "2024-01-01T00:00:00Z"
   */
  activationExpirationDate?: Instant;

  /**
   * The URL to check registration status.
   * @example "https://instant.oianalytics.com/check"
   */
  checkUrl: string | null;

  /**
   * Whether to use a proxy for registration.
   * @example false
   */
  useProxy: boolean;

  /**
   * The proxy URL for registration.
   * @example null
   */
  proxyUrl: string | null;

  /**
   * The username for proxy authentication.
   * @example null
   */
  proxyUsername: string | null;

  /**
   * Whether to use an API Gateway
   * @example false
   */
  useApiGateway: boolean;

  /**
   * The header key for the API gateway
   * @example null
   */
  apiGatewayHeaderKey: string | null;

  /**
   * The base endpoint used by the API gateway
   * @example /oianalytics
   */
  apiGatewayBaseEndpoint: string | null;

  /**
   * Whether to accept unauthorized certificates.
   * @example false
   */
  acceptUnauthorized: boolean;

  /**
   * The interval in seconds for refreshing commands.
   * @example 60
   */
  commandRefreshInterval: number;

  /**
   * The interval in seconds for retrying commands.
   * @example 10
   */
  commandRetryInterval: number;

  /**
   * The interval in seconds for retrying messages.
   * @example 10
   */
  messageRetryInterval: number;

  /**
   * Permissions for various commands.
   */
  commandPermissions: RegistrationCommandPermissions;
}

/**
 * Registration settings command DTO.
 * Used as the request body for updating registration settings.
 */
export interface RegistrationSettingsCommandDTO {
  /**
   * The host URL for registration.
   * @example "https://instance.oianalytics.com"
   */
  host: string;

  /**
   * Whether to use a proxy for registration.
   * @example false
   */
  useProxy: boolean;

  /**
   * The proxy URL for registration.
   * @example null
   */
  proxyUrl: string | null;

  /**
   * The username for proxy authentication.
   * @example null
   */
  proxyUsername: string | null;

  /**
   * The password for proxy authentication.
   * @example null
   */
  proxyPassword: string | null;

  /**
   * Whether to use an API Gateway
   * @example false
   */
  useApiGateway: boolean;

  /**
   * The header key for the API gateway
   * @example null
   */
  apiGatewayHeaderKey: string | null;

  /**
   * The header value (a secret) used for the API gateway
   * @example null
   */
  apiGatewayHeaderValue: string | null;

  /**
   * The base endpoint used by the API gateway
   * @example /oianalytics
   */
  apiGatewayBaseEndpoint: string | null;

  /**
   * Whether to accept unauthorized certificates.
   * @example false
   */
  acceptUnauthorized: boolean;

  /**
   * The interval in seconds for refreshing commands.
   * @example 60
   */
  commandRefreshInterval: number;

  /**
   * The interval in seconds for retrying commands.
   * @example 10
   */
  commandRetryInterval: number;

  /**
   * The interval in seconds for retrying messages.
   * @example 10
   */
  messageRetryInterval: number;

  /**
   * Permissions for various commands.
   */
  commandPermissions: RegistrationCommandPermissions;
}

/**
 * Engine settings command Data Transfer Object.
 * Used as the request body for updating engine settings.
 */
export interface EngineSettingsCommandDTO {
  general: EngineNameCommandDTO;

  webServer: EngineWebServerCommandDTO;

  proxyServer: EngineProxyCommandDTO;

  logger: EngineLoggerCommandDTO;

  /**
   * Number of days audit log entries are kept before being pruned. `null` (or 0) means audit logs
   * are kept forever.
   * @example 90
   */
  auditRetentionDuration: number | null;
}

/**
 * Engine name command Data Transfer Object.
 * Used as the request body for updating only the engine name.
 */
export interface EngineNameCommandDTO {
  /**
   * The name of the engine.
   * @example "OIBus OT"
   */
  name: string;
}

/**
 * Engine web server command Data Transfer Object.
 * Used as the request body for updating only the web server port and authentication token duration.
 */
export interface EngineWebServerCommandDTO {
  /**
   * The port on which the engine listens.
   * @example 8080
   */
  port: number;

  /**
   * The lifetime of an authentication token. One of AUTH_TOKEN_DURATIONS (jsonwebtoken `ms`-style duration string).
   * @example "7d"
   */
  authTokenDuration: AuthTokenDuration;
}

/**
 * Engine proxy command Data Transfer Object.
 * Used as the request body for updating only the proxy settings.
 */
export interface EngineProxyCommandDTO {
  /**
   * Whether the proxy is enabled.
   * @example false
   */
  enabled: boolean;

  /**
   * The port for the proxy, if enabled.
   * @example null
   */
  port?: number | null;

  /**
   * The username for proxy server authentication.
   * @example null
   */
  username?: string | null;

  /**
   * The password for proxy server authentication.
   * @example null
   */
  password?: string | null;

  /**
   * Upstream forward proxy settings.
   */
  forward?: {
    /**
     * Whether forwarding to an upstream proxy is enabled.
     * @example false
     */
    enabled: boolean;

    /**
     * The URL of the upstream proxy to forward requests through.
     * @example null
     */
    url?: string | null;

    /**
     * The username for upstream proxy authentication.
     * @example null
     */
    username?: string | null;

    /**
     * The password for upstream proxy authentication.
     * @example null
     */
    password?: string | null;
  };
}

/**
 * Engine logger command Data Transfer Object.
 * Used as the request body for updating only the logging parameters.
 * The log category objects are top-level (no wrapper key).
 */
export interface EngineLoggerCommandDTO {
  /**
   * Number of days audit log entries are kept before being pruned. `null` (or 0) means audit logs
   * are kept forever.
   * @example 90
   */
  auditRetentionDuration: number | null;

  /**
   * Console logging configuration.
   */
  console: {
    /**
     * The log level for console output.
     * @example "info"
     */
    level: LogLevel;
  };

  /**
   * File logging configuration.
   */
  file: {
    /**
     * The log level for file output.
     * @example "debug"
     */
    level: LogLevel;

    /**
     * The maximum size of a log file in bytes.
     * @example 10485760
     */
    maxFileSize: number;

    /**
     * The number of log files to keep.
     * @example 5
     */
    numberOfFiles: number;
  };

  /**
   * Database logging configuration.
   */
  database: {
    /**
     * The log level for database output.
     * @example "warn"
     */
    level: LogLevel;

    /**
     * The maximum number of logs to keep in the database.
     * @example 10000
     */
    maxNumberOfLogs: number;
  };

  /**
   * Loki logging configuration.
   */
  loki: {
    /**
     * The log level for Loki output.
     * @example "error"
     */
    level: LogLevel;

    /**
     * The interval in seconds for sending logs to Loki.
     * @example 60
     */
    interval: number;

    /**
     * The address of the Loki server.
     * @example "http://loki:3100"
     */
    address?: string;

    /**
     * The username for Loki authentication.
     * @example "user"
     */
    username?: string;

    /**
     * The password for Loki authentication.
     * @example "pass"
     */
    password?: string;
  };

  /**
   * OIA logging configuration.
   */
  oia: {
    /**
     * The log level for OIA output.
     * @example "info"
     */
    level: LogLevel;

    /**
     * The interval in seconds for sending logs to OIA.
     * @example 60
     */
    interval: number;
  };

  /**
   * Syslog logging configuration.
   */
  syslog: {
    /**
     * The log level for syslog output.
     * @example "info"
     */
    level: LogLevel;

    /**
     * The hostname or IP of the syslog server. Empty string disables the transport.
     * @example "syslog.example.com"
     */
    host?: string;

    /**
     * The port of the syslog server.
     * @example 514
     */
    port: number;

    /**
     * The transport protocol.
     * @example "udp4"
     */
    protocol: 'udp4' | 'tcp';
  };
}

/**
 * Engine settings update result Data Transfer Object.
 * Returned after updating engine settings to indicate if a redirect is needed.
 */
export interface EngineSettingsUpdateResultDTO {
  /**
   * Whether the client needs to redirect due to a port change.
   * @example true
   */
  needsRedirect: boolean;

  /**
   * The new port to redirect to, if applicable.
   * @example 3333
   */
  newPort: number | null;
}

/**
 * Memory dump result Data Transfer Object.
 * Returned after a heap snapshot has been written in the OIBus data folder.
 */
export interface EngineMemoryDumpDTO {
  /**
   * The name of the heap snapshot file, written at the root of the OIBus data folder.
   * @example "oibus-memory-dump-2026-09-28_14-30-00.heapsnapshot"
   */
  filename: string;
}

/**
 * Information about the OIBus instance.
 */
export interface OIBusInfo {
  /**
   * The version of OIBus.
   * @example "3.7.0"
   */
  version: string;

  /**
   * The version of the launcher.
   * @example "3.7.0"
   */
  launcherVersion: string;

  /**
   * The name of the OIBus instance.
   * @example "OIBus OT"
   */
  oibusName: string;

  /**
   * The ID of the OIBus instance.
   * @example "aBc12F"
   */
  oibusId: string;

  /**
   * The data directory for OIBus.
   * @example "/var/lib/oibus"
   */
  dataDirectory: string;

  /**
   * The binary directory for OIBus.
   * @example "/usr/lib/oibus"
   */
  binaryDirectory: string;

  /**
   * The process ID of the OIBus instance.
   * @example "12345"
   */
  processId: string;

  /**
   * The hostname of the machine running OIBus.
   * @example "server1"
   */
  hostname: string;

  /**
   * The operating system of the machine.
   * @example "linux"
   */
  operatingSystem: string;

  /**
   * The architecture of the machine.
   * @example "x64"
   */
  architecture: string;

  /**
   * The platform of the machine.
   * @example "ubuntu"
   */
  platform: string;

  /**
   * Whether IP filters are ignored (disabled) via the --ignoreIpFilters launch flag.
   */
  ignoreIpFilters: boolean;

  /**
   * Whether remote update is ignored (disabled) via the --ignoreRemoteUpdate launch flag.
   */
  ignoreRemoteUpdate: boolean;
}

/**
 * Home metrics containing metrics for norths, souths, and the engine.
 */
export interface HomeMetrics {
  /**
   * Metrics for north connectors, keyed by connector ID.
   */
  norths: Record<string, NorthConnectorMetrics>;

  /**
   * Metrics for the engine.
   */
  engine: EngineMetrics;

  /**
   * Metrics for south connectors, keyed by connector ID.
   */
  souths: Record<string, SouthConnectorMetrics>;
}

export interface CacheMove {
  action: 'move';
  source: DataFolderType;
  destination: DataFolderType;
  filenames: Array<string>;
}

export interface CacheRemove {
  action: 'remove';
  folder: DataFolderType;
  filenames: Array<string>;
}

export interface CacheView {
  action: 'view';
  folder: DataFolderType;
  filename: string;
}

export type CacheOperation = CacheView | CacheRemove | CacheMove;
