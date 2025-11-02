import { BaseEntity } from './types';
import { OIBusNorthType } from './north-connector.model';
import { OIBusSouthType } from './south-connector.model';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { NorthSettings } from './north-settings.model';
import { ScanModeDTO } from './scan-mode.model';
import { TransformerDTOWithOptions, TransformerIdWithOptions } from './transformer.model';

/**
 * List of possible statuses for a history query.
 * Represents the different states a history query can be in during its lifecycle.
 */
export const HISTORY_QUERY_STATUS = [
  'PENDING', // Query is created but not yet started
  'RUNNING', // Query is actively running
  'PAUSED', // Query execution is paused
  'FINISHED', // Query has completed successfully
  'ERRORED' // Query encountered an error and stopped
] as const;

/**
 * Type representing the possible statuses for a history query.
 *
 * @example 'RUNNING'
 */
export type HistoryQueryStatus = (typeof HISTORY_QUERY_STATUS)[number];

/**
 * Lightweight Data Transfer Object for a history query.
 * Contains essential information about a history query for listing and overview purposes.
 */
export interface HistoryQueryLightDTO extends BaseEntity {
  /**
   * The name of the history query.
   *
   * @example "Production Data Migration"
   */
  name: string;

  /**
   * Description of the history query's purpose.
   *
   * @example "Migrate production data from old to new system"
   */
  description: string;

  /**
   * Current status of the history query.
   *
   * @example "RUNNING"
   */
  status: HistoryQueryStatus;

  /**
   * Start time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-01T00:00:00Z"
   */
  startTime: string;

  /**
   * End time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-31T23:59:59Z"
   */
  endTime: string;

  /**
   * The type of the South connector used for data retrieval.
   *
   * @example "opcua"
   */
  southType: OIBusSouthType;

  /**
   * The type of the North connector used for data storage.
   *
   * @example "aws-s3"
   */
  northType: OIBusNorthType;
}

/**
 * Data Transfer Object for a history query.
 * Contains all configuration details and current state of a history query.
 */
export interface HistoryQueryDTO extends BaseEntity {
  /**
   * The name of the history query.
   *
   * @example "Production Data Migration"
   */
  name: string;

  /**
   * Description of the history query's purpose.
   *
   * @example "Migrate production data from old to new system"
   */
  description: string;

  /**
   * Current status of the history query.
   *
   * @example "RUNNING"
   */
  status: HistoryQueryStatus;

  /**
   * Start time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-01T00:00:00Z"
   */
  startTime: string;

  /**
   * End time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-31T23:59:59Z"
   */
  endTime: string;

  /**
   * The type of the South connector used for data retrieval.
   *
   * @example "folder-scanner"
   */
  southType: OIBusSouthType;

  /**
   * The type of the North connector used for data storage.
   *
   * @example "console"
   */
  northType: OIBusNorthType;

  /**
   * Configuration settings for the South connector.
   *
   * @example
   * {
   *   "inputFolder": "./input",
   *   "compression": true
   * }
   */
  southSettings: SouthSettings;

  /**
   * Configuration settings for the North connector.
   *
   * @example
   * {
   *   "verbose": true
   * }
   */
  northSettings: NorthSettings;

  /**
   * Caching configuration for the history query.
   */
  caching: {
    /**
     * Trigger configuration for when to send cached data.
     */
    trigger: {
      /**
       * The scan mode configuration determining when to trigger data sends.
       */
      scanMode: ScanModeDTO;

      /**
       * Number of elements to accumulate before triggering a send.
       *
       * @example 1000
       */
      numberOfElements: number;

      /**
       * Number of files to accumulate before triggering a send.
       *
       * @example 10
       */
      numberOfFiles: number;
    };

    /**
     * Throttling configuration to control data flow.
     */
    throttling: {
      /**
       * Minimum delay (in ms) between execution runs.
       *
       * @example 3600000
       */
      runMinDelay: number;

      /**
       * Maximum size (in bytes) of the cache before sending.
       *
       * @example 104857600
       */
      maxSize: number;

      /**
       * Maximum number of elements in the cache before sending.
       *
       * @example 50000
       */
      maxNumberOfElements: number;
    };

    /**
     * Error handling configuration.
     */
    error: {
      /**
       * Interval (in ms) between retry attempts for failed operations.
       *
       * @example 300000
       */
      retryInterval: number;

      /**
       * Maximum number of retry attempts for failed operations.
       *
       * @example 3
       */
      retryCount: number;

      /**
       * Duration (in ms) to retain error files before cleanup.
       *
       * @example 2592000000
       */
      retentionDuration: number;
    };

    /**
     * Archive configuration for completed data.
     */
    archive: {
      /**
       * Whether archiving of processed data is enabled.
       *
       * @example true
       */
      enabled: boolean;

      /**
       * Duration (in ms) to retain archived files.
       *
       * @example 31536000000
       */
      retentionDuration: number;
    };
  };

  /**
   * List of items (data points) to be queried.
   */
  items: Array<HistoryQueryItemDTO>;

  /**
   * List of transformers to apply to data before sending to North connector.
   */
  northTransformers: Array<TransformerDTOWithOptions>;
}

/**
 * Command Data Transfer Object for creating or updating a history query.
 * Used as the request body for history query creation/update endpoints.
 */
export interface HistoryQueryCommandDTO {
  /**
   * The name of the history query.
   *
   * @example "Production Data Migration"
   */
  name: string;

  /**
   * Description of the history query's purpose.
   *
   * @example "Migrate production data from old to new system"
   */
  description: string;

  /**
   * Start time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-01T00:00:00Z"
   */
  startTime: string;

  /**
   * End time for the data to be queried (ISO 8601 format).
   *
   * @example "2023-01-31T23:59:59Z"
   */
  endTime: string;

  /**
   * The type of the South connector to use for data retrieval.
   *
   * @example "folder-scanner"
   */
  southType: OIBusSouthType;

  /**
   * The type of the North connector to use for data storage.
   *
   * @example "console"
   */
  northType: OIBusNorthType;

  /**
   * Configuration settings for the South connector.
   *
   * @example
   * {
   *   "inputFolder": "./input",
   *   "compression": true
   * }
   */
  southSettings: SouthSettings;

  /**
   * Configuration settings for the North connector.
   *
   * @example
   * {
   *   "verbose": true
   * }
   */
  northSettings: NorthSettings;

  /**
   * Caching configuration for the history query.
   */
  caching: {
    /**
     * Trigger configuration for when to send cached data.
     */
    trigger: {
      /**
       * ID of the scan mode to use.
       *
       * @example "daily"
       */
      scanModeId: string;

      /**
       * Name of the scan mode. Used when ID is not available.
       *
       * @example "Daily"
       */
      scanModeName: string | null;

      /**
       * Number of elements to accumulate before triggering a send.
       *
       * @example 1000
       */
      numberOfElements: number;

      /**
       * Number of files to accumulate before triggering a send.
       *
       * @example 10
       */
      numberOfFiles: number;
    };

    /**
     * Throttling configuration to control data flow.
     */
    throttling: {
      /**
       * Minimum delay (in ms) between execution runs.
       *
       * @example 3600000
       */
      runMinDelay: number;

      /**
       * Maximum size (in bytes) of the cache before sending.
       *
       * @example 104857600
       */
      maxSize: number;

      /**
       * Maximum number of elements in the cache before sending.
       *
       * @example 50000
       */
      maxNumberOfElements: number;
    };

    /**
     * Error handling configuration.
     */
    error: {
      /**
       * Interval (in ms) between retry attempts for failed operations.
       *
       * @example 300000
       */
      retryInterval: number;

      /**
       * Maximum number of retry attempts for failed operations.
       *
       * @example 3
       */
      retryCount: number;

      /**
       * Duration (in ms) to retain error files before cleanup.
       *
       * @example 2592000000
       */
      retentionDuration: number;
    };

    /**
     * Archive configuration for completed data.
     */
    archive: {
      /**
       * Whether archiving of processed data is enabled.
       *
       * @example true
       */
      enabled: boolean;

      /**
       * Duration (in ms) to retain archived files.
       *
       * @example 31536000000
       */
      retentionDuration: number;
    };
  };

  /**
   * List of items (data points) to be queried.
   */
  items: Array<HistoryQueryItemCommandDTO>;

  /**
   * List of transformers to apply to data before sending to North connector.
   * Each transformer is referenced by ID with its options.
   */
  northTransformers: Array<TransformerIdWithOptions>;
}

/**
 * Data Transfer Object for a history query item.
 * Represents an individual data point to be queried.
 */
export interface HistoryQueryItemDTO extends BaseEntity {
  /**
   * The name of the history query item.
   *
   * @example "Temperature Sensors"
   */
  name: string;

  /**
   * Whether this item is enabled and should be queried.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * Item-specific settings for the South connector.
   *
   * @example
   * {
   *   "regex": "*.csv"
   *   "minAge": 1000,
   *   "preserveFiles": true,
   *   "ignoreModifiedDate": false
   * }
   */
  settings: SouthItemSettings;
}

/**
 * Command Data Transfer Object for creating or updating a history query item.
 * Used as the request body for history query item creation/update endpoints.
 */
export interface HistoryQueryItemCommandDTO {
  /**
   * The ID of the item (null when creating a new item).
   *
   * @example null
   */
  id: string | null;

  /**
   * The name of the history query item.
   *
   * @example "Temperature Sensors"
   */
  name: string;

  /**
   * Whether this item should be enabled.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * Item-specific settings for the South connector.
   *
   * @example
   * {
   *   "regex": "*.csv"
   *   "minAge": 1000,
   *   "preserveFiles": true,
   *   "ignoreModifiedDate": false
   * }
   */
  settings: SouthItemSettings;
}

/**
 * Search parameters for history query items.
 * Used for filtering and paginating item lists.
 */
export interface HistoryQueryItemSearchParam {
  /**
   * Name filter for items (partial match).
   * Undefined means no name filtering.
   *
   * @example "temperature"
   */
  name: string | undefined;

  /**
   * Filter by enabled status.
   * Undefined means no filtering by enabled status.
   *
   * @example true
   */
  enabled: boolean | undefined;

  /**
   * Page number for pagination (0-based index).
   *
   * @example 0
   */
  page: number;
}
