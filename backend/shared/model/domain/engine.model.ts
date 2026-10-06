import { OIBusTimeValue } from '../common/content.model';
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
 * List of possible registration statuses.
 */
export const REGISTRATION_STATUS = ['NOT_REGISTERED', 'PENDING', 'REGISTERED'] as const;
/**
 * Type representing a registration status.
 * @example 'REGISTERED'
 */
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number];

/**
 * Permissions granted to OIAnalytics for each remote command.
 */
export interface RegistrationCommandPermissions {
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

  /**
   * Permission to search cache content.
   * @example true
   */
  searchHistoryCacheContent: boolean;

  /**
   * Permission to get cache file content.
   * @example true
   */
  getHistoryCacheFileContent: boolean;

  /**
   * Permission to remove cache content.
   * @example true
   */
  updateHistoryCacheContent: boolean;

  /**
   * Permission to search cache content.
   * @example true
   */
  searchNorthCacheContent: boolean;

  /**
   * Permission to get cache file content.
   * @example true
   */
  getNorthCacheFileContent: boolean;

  /**
   * Permission to remove cache content.
   * @example true
   */
  updateNorthCacheContent: boolean;

  /**
   * Permission to create a custom transformer.
   * @example true
   */
  createCustomTransformer: boolean;

  /**
   * Permission to update a custom transformer.
   * @example true
   */
  updateCustomTransformer: boolean;

  /**
   * Permission to delete a custom transformer.
   * @example true
   */
  deleteCustomTransformer: boolean;

  /**
   * Permission to test a custom transformer.
   * @example true
   */
  testCustomTransformer: boolean;
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
   * @example "time-values"
   */
  contentType: string;
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
