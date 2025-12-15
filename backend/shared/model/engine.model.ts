import { BaseEntity, Instant } from './types';
import { LogLevel } from './logs.model';

/**
 * List of possible OIBus data types.
 */
export const OIBUS_DATA_TYPES = ['any', 'time-values', 'setpoint'] as const;
/**
 * Type representing an OIBus data type.
 * @example 'time-values'
 */
export type OIBusDataType = (typeof OIBUS_DATA_TYPES)[number];

/**
 * Engine settings Data Transfer Object.
 * Represents the configuration settings for the engine.
 */
export interface EngineSettingsDTO extends BaseEntity {
  /**
   * The name of the engine.
   * @example "OIBus OT"
   */
  name: string;

  /**
   * The port on which the engine listens.
   * @example 2223
   */
  port: number;

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
   * Whether the proxy is enabled.
   * @example false
   */
  proxyEnabled: boolean;

  /**
   * The port for the proxy, if enabled.
   * @example null
   */
  proxyPort: number | null;

  /**
   * Logging parameters for different outputs.
   */
  logParameters: {
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
  };
}

/**
 * List of possible registration statuses.
 */
export const REGISTRATION_STATUS = ['NOT_REGISTERED', 'PENDING', 'REGISTERED'] as const;
/**
 * Type representing a registration status.
 * @example 'REGISTERED'
 */
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number];

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
  commandPermissions: {
    /**
     * Permission to update the engine version.
     * @example true
     */
    updateVersion: boolean;

    /**
     * Permission to restart the engine.
     * @example true
     */
    restartEngine: boolean;

    /**
     * Permission to regenerate cipher keys.
     * @example true
     */
    regenerateCipherKeys: boolean;

    /**
     * Permission to update engine settings.
     * @example true
     */
    updateEngineSettings: boolean;

    /**
     * Permission to update registration settings.
     * @example true
     */
    updateRegistrationSettings: boolean;

    /**
     * Permission to create a scan mode.
     * @example true
     */
    createScanMode: boolean;

    /**
     * Permission to update a scan mode.
     * @example true
     */
    updateScanMode: boolean;

    /**
     * Permission to delete a scan mode.
     * @example true
     */
    deleteScanMode: boolean;

    /**
     * Permission to create an IP filter.
     * @example true
     */
    createIpFilter: boolean;

    /**
     * Permission to update an IP filter.
     * @example true
     */
    updateIpFilter: boolean;

    /**
     * Permission to delete an IP filter.
     * @example true
     */
    deleteIpFilter: boolean;

    /**
     * Permission to create a certificate.
     * @example true
     */
    createCertificate: boolean;

    /**
     * Permission to update a certificate.
     * @example true
     */
    updateCertificate: boolean;

    /**
     * Permission to delete a certificate.
     * @example true
     */
    deleteCertificate: boolean;

    /**
     * Permission to create a history query.
     * @example true
     */
    createHistoryQuery: boolean;

    /**
     * Permission to update a history query.
     * @example true
     */
    updateHistoryQuery: boolean;

    /**
     * Permission to delete a history query.
     * @example true
     */
    deleteHistoryQuery: boolean;

    /**
     * Permission to create or update history items from CSV.
     * @example true
     */
    createOrUpdateHistoryItemsFromCsv: boolean;

    /**
     * Permission to create a south connector.
     * @example true
     */
    createSouth: boolean;

    /**
     * Permission to update a south connector.
     * @example true
     */
    updateSouth: boolean;

    /**
     * Permission to delete a south connector.
     * @example true
     */
    deleteSouth: boolean;

    /**
     * Permission to create or update south items from CSV.
     * @example true
     */
    createOrUpdateSouthItemsFromCsv: boolean;

    /**
     * Permission to create a north connector.
     * @example true
     */
    createNorth: boolean;

    /**
     * Permission to update a north connector.
     * @example true
     */
    updateNorth: boolean;

    /**
     * Permission to delete a north connector.
     * @example true
     */
    deleteNorth: boolean;

    /**
     * Permission to apply setpoints.
     * @example true
     */
    setpoint: boolean;
  };
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
  commandPermissions: {
    /**
     * Permission to update the engine version.
     * @example true
     */
    updateVersion: boolean;

    /**
     * Permission to restart the engine.
     * @example true
     */
    restartEngine: boolean;

    /**
     * Permission to regenerate cipher keys.
     * @example true
     */
    regenerateCipherKeys: boolean;

    /**
     * Permission to update engine settings.
     * @example true
     */
    updateEngineSettings: boolean;

    /**
     * Permission to update registration settings.
     * @example true
     */
    updateRegistrationSettings: boolean;

    /**
     * Permission to create a scan mode.
     * @example true
     */
    createScanMode: boolean;

    /**
     * Permission to update a scan mode.
     * @example true
     */
    updateScanMode: boolean;

    /**
     * Permission to delete a scan mode.
     * @example true
     */
    deleteScanMode: boolean;

    /**
     * Permission to create an IP filter.
     * @example true
     */
    createIpFilter: boolean;

    /**
     * Permission to update an IP filter.
     * @example true
     */
    updateIpFilter: boolean;

    /**
     * Permission to delete an IP filter.
     * @example true
     */
    deleteIpFilter: boolean;

    /**
     * Permission to create a certificate.
     * @example true
     */
    createCertificate: boolean;

    /**
     * Permission to update a certificate.
     * @example true
     */
    updateCertificate: boolean;

    /**
     * Permission to delete a certificate.
     * @example true
     */
    deleteCertificate: boolean;

    /**
     * Permission to create a history query.
     * @example true
     */
    createHistoryQuery: boolean;

    /**
     * Permission to update a history query.
     * @example true
     */
    updateHistoryQuery: boolean;

    /**
     * Permission to delete a history query.
     * @example true
     */
    deleteHistoryQuery: boolean;

    /**
     * Permission to create or update history items from CSV.
     * @example true
     */
    createOrUpdateHistoryItemsFromCsv: boolean;

    /**
     * Permission to test a history north connection.
     * @example true
     */
    testHistoryNorthConnection: boolean;

    /**
     * Permission to test a history south connection.
     * @example true
     */
    testHistorySouthConnection: boolean;

    /**
     * Permission to test a history south item.
     * @example true
     */
    testHistorySouthItem: boolean;

    /**
     * Permission to create a south connector.
     * @example true
     */
    createSouth: boolean;

    /**
     * Permission to update a south connector.
     * @example true
     */
    updateSouth: boolean;

    /**
     * Permission to delete a south connector.
     * @example true
     */
    deleteSouth: boolean;

    /**
     * Permission to create or update south items from CSV.
     * @example true
     */
    createOrUpdateSouthItemsFromCsv: boolean;

    /**
     * Permission to test a south connection.
     * @example true
     */
    testSouthConnection: boolean;

    /**
     * Permission to test a south item.
     * @example true
     */
    testSouthItem: boolean;

    /**
     * Permission to create a north connector.
     * @example true
     */
    createNorth: boolean;

    /**
     * Permission to update a north connector.
     * @example true
     */
    updateNorth: boolean;

    /**
     * Permission to delete a north connector.
     * @example true
     */
    deleteNorth: boolean;

    /**
     * Permission to test a north connection.
     * @example true
     */
    testNorthConnection: boolean;

    /**
     * Permission to apply setpoints.
     * @example true
     */
    setpoint: boolean;
  };
}

/**
 * Crypto settings for encryption.
 */
export interface CryptoSettings {
  /**
   * The encryption algorithm.
   * @example "aes-256-cbc"
   */
  algorithm: string;

  /**
   * The initialization vector for encryption.
   * @example "1234567890abcdef"
   */
  initVector: string;

  /**
   * The security key for encryption.
   * @example "abcdef1234567890abcdef1234567890"
   */
  securityKey: string;
}

/**
 * Engine settings command Data Transfer Object.
 * Used as the request body for updating engine settings.
 */
export interface EngineSettingsCommandDTO {
  /**
   * The name of the engine.
   * @example "OIBus OT"
   */
  name: string;

  /**
   * The port on which the engine listens.
   * @example 8080
   */
  port: number;

  /**
   * Whether the proxy is enabled.
   * @example false
   */
  proxyEnabled: boolean;

  /**
   * The port for the proxy, if enabled.
   * @example null
   */
  proxyPort: number | null;

  /**
   * Logging parameters for different outputs.
   */
  logParameters: {
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
       * @example "info"
       */
      level: LogLevel;

      /**
       * The interval in seconds for sending logs to OIA.
       * @example 60
       */
      interval: number;
    };
  };
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
}

/**
 * Base metrics for connectors.
 */
export interface BaseConnectorMetrics {
  /**
   * The start time of metrics collection.
   * @example "2023-01-01T00:00:00Z"
   */
  metricsStart: Instant;

  /**
   * The last connection time.
   * @example "2023-01-01T00:00:00Z"
   */
  lastConnection: Instant | null;

  /**
   * The start time of the last run.
   * @example "2023-01-01T00:00:00Z"
   */
  lastRunStart: Instant | null;

  /**
   * The duration of the last run in milliseconds.
   * @example 1000
   */
  lastRunDuration: number | null;
}

/**
 * Metrics for a north connector.
 */
export interface NorthConnectorMetrics extends BaseConnectorMetrics {
  /**
   * The size of content sent.
   * @example 1024
   */
  contentSentSize: number;

  /**
   * The size of content that errored.
   * @example 0
   */
  contentErroredSize: number;

  /**
   * The size of content archived.
   * @example 0
   */
  contentArchivedSize: number;

  /**
   * The size of content cached.
   * @example 0
   */
  contentCachedSize: number;

  /**
   * The last content sent.
   * @example "file1.json"
   */
  lastContentSent: string | null;

  /**
   * The current size of the cache.
   * @example 0
   */
  currentCacheSize: number;

  /**
   * The current size of errors.
   * @example 0
   */
  currentErrorSize: number;

  /**
   * The current size of the archive.
   * @example 0
   */
  currentArchiveSize: number;
}

/**
 * Metrics for a south connector.
 */
export interface SouthConnectorMetrics extends BaseConnectorMetrics {
  /**
   * The number of values retrieved.
   * @example 100
   */
  numberOfValuesRetrieved: number;

  /**
   * The number of files retrieved.
   * @example 1
   */
  numberOfFilesRetrieved: number;

  /**
   * The last value retrieved.
   * @example { "pointId": "point1", "timestamp": "2023-01-01T00:00:00Z", "data": { "value": 100 } }
   */
  lastValueRetrieved: OIBusTimeValue | null;

  /**
   * The last file retrieved.
   * @example "file1.json"
   */
  lastFileRetrieved: string | null;
}

/**
 * Metrics for a history query.
 */
export interface HistoryQueryMetrics {
  /**
   * The start time of metrics collection.
   * @example "2023-01-01T00:00:00Z"
   */
  metricsStart: Instant;

  /**
   * Metrics for the north side of the history query.
   */
  north: {
    /**
     * The last connection time.
     * @example "2023-01-01T00:00:00Z"
     */
    lastConnection: Instant | null;

    /**
     * The start time of the last run.
     * @example "2023-01-01T00:00:00Z"
     */
    lastRunStart: Instant | null;

    /**
     * The duration of the last run in milliseconds.
     * @example 1000
     */
    lastRunDuration: number | null;

    /**
     * The size of content sent.
     * @example 1024
     */
    contentSentSize: number;

    /**
     * The size of content that errored.
     * @example 0
     */
    contentErroredSize: number;

    /**
     * The size of content archived.
     * @example 0
     */
    contentArchivedSize: number;

    /**
     * The size of content cached.
     * @example 0
     */
    contentCachedSize: number;

    /**
     * The last content sent.
     * @example "file1.json"
     */
    lastContentSent: string | null;

    /**
     * The current size of the cache.
     * @example 0
     */
    currentCacheSize: number;

    /**
     * The current size of errors.
     * @example 0
     */
    currentErrorSize: number;

    /**
     * The current size of the archive.
     * @example 0
     */
    currentArchiveSize: number;
  };

  /**
   * Metrics for the south side of the history query.
   */
  south: {
    /**
     * The last connection time.
     * @example "2023-01-01T00:00:00Z"
     */
    lastConnection: Instant | null;

    /**
     * The start time of the last run.
     * @example "2023-01-01T00:00:00Z"
     */
    lastRunStart: Instant | null;

    /**
     * The duration of the last run in milliseconds.
     * @example 1000
     */
    lastRunDuration: number | null;

    /**
     * The number of values retrieved.
     * @example 100
     */
    numberOfValuesRetrieved: number;

    /**
     * The number of files retrieved.
     * @example 1
     */
    numberOfFilesRetrieved: number;

    /**
     * The last value retrieved.
     * @example { "pointId": "point1", "timestamp": "2023-01-01T00:00:00Z", "data": { "value": 100 } }
     */
    lastValueRetrieved: OIBusTimeValue | null;

    /**
     * The last file retrieved.
     * @example "file1.json"
     */
    lastFileRetrieved: string | null;
  };

  /**
   * Metrics for the history query itself.
   */
  historyMetrics: {
    /**
     * Whether the history query is currently running.
     * @example true
     */
    running: boolean;

    /**
     * The progress of the current interval as a fraction [0, 1].
     * @example 0.5
     */
    intervalProgress: number;

    /**
     * The start of the current interval.
     * @example "2023-01-01T00:00:00Z"
     */
    currentIntervalStart: Instant | null;

    /**
     * The end of the current interval.
     * @example "2023-01-02T00:00:00Z"
     */
    currentIntervalEnd: Instant | null;

    /**
     * The number of the current interval.
     * @example 1
     */
    currentIntervalNumber: number;

    /**
     * The maximum number of intervals.
     * @example 2
     */
    numberOfIntervals: number;
  };
}

/**
 * Metrics for the engine.
 */
export interface EngineMetrics {
  /**
   * The start time of metrics collection.
   * @example "2023-01-01T00:00:00Z"
   */
  metricsStart: Instant;

  /**
   * The instantaneous CPU usage of the process.
   * @example 0.5
   */
  processCpuUsageInstant: number;

  /**
   * The average CPU usage of the process.
   * @example 0.3
   */
  processCpuUsageAverage: number;

  /**
   * The uptime of the process in seconds.
   * @example 3600
   */
  processUptime: number;

  /**
   * The amount of free memory in bytes.
   * @example 1073741824
   */
  freeMemory: number;

  /**
   * The total amount of memory in bytes.
   * @example 2147483648
   */
  totalMemory: number;

  /**
   * The minimum resident set size in bytes.
   * @example 104857600
   */
  minRss: number;

  /**
   * The current resident set size in bytes.
   * @example 157286400
   */
  currentRss: number;

  /**
   * The maximum resident set size in bytes.
   * @example 209715200
   */
  maxRss: number;

  /**
   * The minimum heap total size in bytes.
   * @example 52428800
   */
  minHeapTotal: number;

  /**
   * The current heap total size in bytes.
   * @example 73400320
   */
  currentHeapTotal: number;

  /**
   * The maximum heap total size in bytes.
   * @example 94371840
   */
  maxHeapTotal: number;

  /**
   * The minimum heap used size in bytes.
   * @example 31457280
   */
  minHeapUsed: number;

  /**
   * The current heap used size in bytes.
   * @example 47185920
   */
  currentHeapUsed: number;

  /**
   * The maximum heap used size in bytes.
   * @example 62914560
   */
  maxHeapUsed: number;

  /**
   * The minimum external memory size in bytes.
   * @example 1048576
   */
  minExternal: number;

  /**
   * The current external memory size in bytes.
   * @example 2097152
   */
  currentExternal: number;

  /**
   * The maximum external memory size in bytes.
   * @example 3145728
   */
  maxExternal: number;

  /**
   * The minimum ArrayBuffers size in bytes.
   * @example 1048576
   */
  minArrayBuffers: number;

  /**
   * The current ArrayBuffers size in bytes.
   * @example 2097152
   */
  currentArrayBuffers: number;

  /**
   * The maximum ArrayBuffers size in bytes.
   * @example 3145728
   */
  maxArrayBuffers: number;
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

/**
 * Base interface for OIBus content.
 */
interface BaseOIBusContent {
  /**
   * The type of content.
   */
  type: string;
}

/**
 * A time-value pair.
 */
export interface OIBusTimeValue {
  /**
   * The ID of the point.
   * @example "point1"
   */
  pointId: string;

  /**
   * The timestamp of the value.
   * @example "2023-01-01T00:00:00Z"
   */
  timestamp: Instant;

  /**
   * The data associated with the point.
   */
  data: {
    /**
     * The value of the point.
     * @example "100"
     */
    value: string | number;

    /**
     * Additional data associated with the point.
     */
    [key: string]: string | number;
  };
}

/**
 * Time-value content.
 */
export interface OIBusTimeValueContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "time-values"
   */
  type: 'time-values';

  /**
   * The array of time-value pairs.
   */
  content: Array<OIBusTimeValue>;
}

/**
 * A setpoint.
 */
export interface OIBusSetpoint {
  /**
   * The reference of the setpoint.
   * @example "setpoint1"
   */
  reference: string;

  /**
   * The value of the setpoint.
   * @example 100
   */
  value: string | number | boolean;
}

/**
 * Setpoint content.
 */
export interface OIBusSetpointContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "setpoint"
   */
  type: 'setpoint';

  /**
   * The array of setpoints.
   */
  content: Array<OIBusSetpoint>;
}

/**
 * Raw content.
 */
export interface OIBusRawContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "any"
   */
  type: 'any';

  /**
   * The path to the file containing the content.
   * @example "/path/to/file.json"
   */
  filePath: string;

  /**
   * The content itself, if available.
   */
  content?: string;
}

/**
 * Type representing OIBus content.
 */
export type OIBusContent = OIBusTimeValueContent | OIBusRawContent | OIBusSetpointContent;

/**
 * Metadata for cached content.
 */
export interface CacheMetadata {
  /**
   * The path to the content file.
   * @example "/path/to/content.json"
   */
  contentFile: string;

  /**
   * The size of the content in bytes.
   * @example 1024
   */
  contentSize: number;

  /**
   * The number of elements in the content.
   * @example 10
   */
  numberOfElement: number;

  /**
   * The creation time of the content.
   * @example "2023-01-01T00:00:00Z"
   */
  createdAt: Instant;

  /**
   * The type of the content.
   * @example "time-values"
   */
  contentType: string;

  /**
   * The source of the content (southId or null).
   * @example "south1"
   */
  source: string | null;

  /**
   * Additional options associated with the content.
   */
  options: Record<string, string | number>;
}

/**
 * Parameters for searching the cache.
 */
export interface CacheSearchParam {
  /**
   * The start time for the search.
   * @example "2023-01-01T00:00:00Z"
   */
  start: string | undefined;

  /**
   * The end time for the search.
   * @example "2023-01-02T00:00:00Z"
   */
  end: string | undefined;

  /**
   * A string that the content name must contain.
   * @example "example"
   */
  nameContains: string | undefined;
}
