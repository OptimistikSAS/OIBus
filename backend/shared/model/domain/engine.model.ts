import { OIBusRecord } from '../common/content.model';
import { Instant } from '../common/types';

/**
 * List of allowed durations for the authentication token lifetime, in the same
 * format accepted by jsonwebtoken's `expiresIn` (via the `ms` package).
 */
export const AUTH_TOKEN_DURATIONS = ['1h', '6h', '1d', '3d', '7d', '14d', '30d'] as const;
/**
 * Type representing an allowed authentication token duration.
 * @example "7d"
 */
export type AuthTokenDuration = (typeof AUTH_TOKEN_DURATIONS)[number];

/**
 * List of protocols the web server can serve its UI and API with.
 */
export const WEB_SERVER_PROTOCOLS = ['http', 'https'] as const;
/**
 * Type representing a web server protocol.
 * @example "https"
 */
export type WebServerProtocol = (typeof WEB_SERVER_PROTOCOLS)[number];

/**
 * List of places the web server can read its HTTPS certificate and private key from: a certificate of the OIBus
 * certificate store, or PEM files on the OIBus machine.
 */
export const WEB_SERVER_CERTIFICATE_SOURCES = ['store', 'file'] as const;
/**
 * Type representing where the web server reads its HTTPS certificate from.
 * @example "store"
 */
export type WebServerCertificateSource = (typeof WEB_SERVER_CERTIFICATE_SOURCES)[number];

/**
 * HTTPS settings of the web server.
 */
export interface WebServerHttpsSettings {
  /**
   * Whether the web server serves HTTPS instead of HTTP.
   * @example true
   */
  enabled: boolean;

  /**
   * Where the certificate and its private key are read from.
   * @example "store"
   */
  certificateSource: WebServerCertificateSource;

  /**
   * The id of the certificate of the OIBus certificate store, when the source is 'store'.
   * @example "certificateId"
   */
  certificateId: string | null;

  /**
   * The path of the PEM certificate file (optionally followed by its CA chain), when the source is 'file'. A relative path
   * is resolved from the OIBus data folder.
   * @example "/etc/oibus/oibus.crt"
   */
  certificatePath: string | null;

  /**
   * The path of the PEM private key file (not encrypted), when the source is 'file'. A relative path is resolved from the
   * OIBus data folder.
   * @example "/etc/oibus/oibus.key"
   */
  privateKeyPath: string | null;
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
 * The permissions granted to OIAnalytics, each one allowing a set of remote commands with the same risk.
 */
export const COMMAND_PERMISSIONS = [
  'updateVersion',
  'operate',
  'configureEngine',
  'configureDataFlow',
  'configureCustomCode',
  'manageAccess',
  'manageRegistration',
  'connectToDataSources',
  'manageCache',
  'diagnostics',
  'setpoint'
] as const;

/**
 * A permission granted to OIAnalytics.
 * @example 'configureDataFlow'
 */
export type CommandPermission = (typeof COMMAND_PERMISSIONS)[number];

/**
 * Permissions granted to OIAnalytics, scoped by risk. Importing a full configuration is not a permission of its own: it
 * requires every permission changing the configuration (configureEngine, configureDataFlow, configureCustomCode and
 * manageAccess), as it replaces all of it.
 */
export interface RegistrationCommandPermissions {
  /**
   * Update the version of OIBus, replacing its binaries.
   * @example true
   */
  updateVersion: boolean;

  /**
   * Change what runs without changing the configuration: restart OIBus, start or stop a history query.
   * @example true
   */
  operate: boolean;

  /**
   * Update the general, proxy and logger settings of the engine.
   * @example true
   */
  configureEngine: boolean;

  /**
   * Create, update and delete the South connectors, North connectors, history queries (and their items), scan modes and
   * certificates. Updating a connector is as powerful as creating or deleting one: it can send the data anywhere, or stop
   * collecting it.
   * @example true
   */
  configureDataFlow: boolean;

  /**
   * Create, update, delete and test custom transformers, which run code sent by OIAnalytics (in a sandbox).
   * @example false
   */
  configureCustomCode: boolean;

  /**
   * Update the web server settings and the IP filters, which control who can reach the OIBus web interface.
   * @example true
   */
  manageAccess: boolean;

  /**
   * Update the registration settings and regenerate the cipher keys of the registration. Permissions can only be revoked
   * remotely, never granted.
   * @example true
   */
  manageRegistration: boolean;

  /**
   * Connect to the data sources and destinations with the settings sent by OIAnalytics, without saving anything: test a
   * connection or an item, test a transformer, open an interactive session to explore a data source.
   * @example true
   */
  connectToDataSources: boolean;

  /**
   * Search, read, move and remove the files of the cache of the North connectors and history queries. Their content is
   * process data, and removing it loses that data.
   * @example true
   */
  manageCache: boolean;

  /**
   * Retrieve a memory dump or the logs database. A memory dump may contain secrets in clear text.
   * @example false
   */
  diagnostics: boolean;

  /**
   * Write setpoints to the equipment through the South connectors.
   * @example false
   */
  setpoint: boolean;
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
  lastValueRetrieved: OIBusRecord | null;

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
    lastValueRetrieved: OIBusRecord | null;

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

    /**
     * The name of the item currently being queried. Only set for connectors that query items one
     * at a time (SOUTH_SINGLE_ITEMS).
     * @example "item1"
     */
    itemName?: string;

    /**
     * The 1-based index of the item currently being queried, among the run's enabled items. Only
     * set for connectors that query items one at a time (SOUTH_SINGLE_ITEMS).
     * @example 3
     */
    currentItemNumber?: number;

    /**
     * The total number of enabled items in the run. Only set for connectors that query items one
     * at a time (SOUTH_SINGLE_ITEMS).
     * @example 10
     */
    numberOfItems?: number;

    /**
     * The progress of the current item's own interval list as a fraction [0, 1], scoped to that
     * item only (not ratcheted, unlike `intervalProgress`). Only set for connectors that query
     * items one at a time (SOUTH_SINGLE_ITEMS).
     * @example 0.25
     */
    itemIntervalProgress?: number;

    /**
     * The 1-based index of the current lead's own interval, within its own interval list (raw, not
     * ratcheted) — same source data as `itemIntervalProgress`, surfaced raw for display. Only set
     * for connectors that query items one at a time (SOUTH_SINGLE_ITEMS).
     * @example 12
     */
    itemIntervalNumber?: number;

    /**
     * The total number of intervals in the current lead's own interval list (raw, not ratcheted).
     * Only set for connectors that query items one at a time (SOUTH_SINGLE_ITEMS).
     * @example 34
     */
    itemNumberOfIntervals?: number;

    /**
     * The runtime status of every item in the run. Only set for connectors that query items one at
     * a time (SOUTH_SINGLE_ITEMS).
     */
    itemsStatus?: Array<HistoryQueryItemStatus>;
  };
}

/**
 * Runtime status of a single item within a history query run, for progress-monitoring UIs.
 */
export interface HistoryQueryItemStatus {
  /**
   * The item ID.
   * @example "e4f7e3f0-1234-4567-8901-abcdef123456"
   */
  itemId: string;

  /**
   * The item name.
   * @example "item1"
   */
  itemName: string;

  /**
   * The item's runtime status within the run.
   * @example "running"
   */
  status: 'pending' | 'running' | 'done';

  /**
   * The timestamp of the last value retrieved for this item.
   * @example "2023-01-01T00:00:00Z"
   */
  lastValueTimestamp: Instant | null;

  /**
   * The number of records (values or files) retrieved for this item so far.
   * @example 42
   */
  recordsCount: number;
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
   * @example "record-list"
   */
  contentType: string;

  /**
   * The South connector the content comes from. Content from different South connectors is never merged together, so
   * that the receiver can know where each batch comes from.
   * Absent for content not coming from a South connector (history queries, OIBus API, OIAnalytics setpoints).
   */
  dataSource?: CacheMetadataDataSource | null;
}

export interface CacheMetadataDataSource {
  /**
   * @example "southId1"
   */
  id: string;
  /**
   * @example "My South"
   */
  name: string;
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

  /**
   * The maximum number of file to return. Default to 0, meaning no limit
   */
  maxNumberOfFilesReturned: number;
}

export interface CacheSearchResult {
  searchDate: Instant;
  metrics: {
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
  error: Array<{ filename: string; metadata: CacheMetadata }>;
  archive: Array<{ filename: string; metadata: CacheMetadata }>;
  cache: Array<{ filename: string; metadata: CacheMetadata }>;
}

export type DataFolderType = 'cache' | 'error' | 'archive';

export interface CacheContentUpdateCommand {
  cache: {
    remove: Array<string>;
    move: Array<{ filename: string; to: DataFolderType }>;
  };
  error: {
    remove: Array<string>;
    move: Array<{ filename: string; to: DataFolderType }>;
  };
  archive: {
    remove: Array<string>;
    move: Array<{ filename: string; to: DataFolderType }>;
  };
}

export interface FileCacheContent {
  content: string;
  contentFilename: string;
  contentType: 'csv' | 'xml' | 'json' | 'raw';
  truncated: boolean;
  totalSize: number;
}

export interface OIBusConnectionTestResult {
  items: Array<{ key: string; value: string }>;
}
