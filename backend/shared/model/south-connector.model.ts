import { BaseEntity, Instant } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { ScanModeDTO } from './scan-mode.model';
import { OIBusArrayAttribute, OIBusObjectAttribute } from './form.model';

/**
 * List of available categories for OIBus South connectors.
 * Categories group similar types of connectors together.
 */
export const OIBUS_SOUTH_CATEGORIES = [
  'file', // File-based data sources
  'iot', // IoT protocols and devices
  'database', // Database systems
  'api' // API-based data sources
] as const;

/**
 * Type representing the possible categories for a South connector.
 *
 * @example 'file'
 */
export type OIBusSouthCategory = (typeof OIBUS_SOUTH_CATEGORIES)[number];

/**
 * List of available types for OIBus South connectors.
 * Each type represents a specific protocol or data source system.
 */
export const OIBUS_SOUTH_TYPES = [
  'ads', // Beckhoff ADS protocol
  'folder-scanner', // File system folder scanning
  'ftp', // FTP file transfer protocol
  'modbus', // Modbus industrial protocol
  'mqtt', // MQTT messaging protocol
  'mssql', // Microsoft SQL Server database
  'mysql', // MySQL database
  'odbc', // ODBC database connection
  'oianalytics', // OIAnalytics specific connector
  'oledb', // OLE DB database connection
  'opc', // Classic OPC (OLE for Process Control)
  'opcua', // OPC Unified Architecture
  'oracle', // Oracle database
  'osisoft-pi', // OSIsoft PI System
  'postgresql', // PostgreSQL database
  'rest-api', // REST API connector
  'sftp', // SFTP file transfer protocol
  'sqlite' // SQLite database
] as const;

/**
 * Type representing the possible types for a South connector.
 *
 * @example 'folder-scanner'
 */
export type OIBusSouthType = (typeof OIBUS_SOUTH_TYPES)[number];

/**
 * Represents the type metadata for a South connector.
 * Describes the basic characteristics and capabilities of a South connector type.
 */
export interface SouthType {
  /**
   * The unique identifier of the South connector type.
   *
   * @example "folder-scanner"
   */
  id: OIBusSouthType;

  /**
   * The category of the South connector.
   *
   * @example "file"
   */
  category: OIBusSouthCategory;

  /**
   * The operating modes supported by this connector type.
   */
  modes: {
    /**
     * Whether this connector supports real-time subscription mode.
     *
     * @example false
     */
    subscription: boolean;

    /**
     * Whether this connector supports retrieving the last data point.
     *
     * @example false
     */
    lastPoint: boolean;

    /**
     * Whether this connector supports retrieving the last file.
     *
     * @example true
     */
    lastFile: boolean;

    /**
     * Whether this connector supports historical data retrieval.
     *
     * @example false
     */
    history: boolean;
  };
}

/**
 * Lightweight Data Transfer Object for a South connector.
 * Contains only essential information about a South connector for listing purposes.
 */
export interface SouthConnectorLightDTO extends BaseEntity {
  /**
   * The name of the South connector.
   *
   * @example "Production Data Files"
   */
  name: string;

  /**
   * The type of the South connector.
   *
   * @example "folder-scanner"
   */
  type: OIBusSouthType;

  /**
   * Description of the South connector's purpose.
   *
   * @example "Scans production data CSV files"
   */
  description: string;

  /**
   * Whether the South connector is enabled and active.
   *
   * @example true
   */
  enabled: boolean;
}

/**
 * Data Transfer Object for a South connector.
 * Contains all configuration details and current state of a South connector.
 */
export interface SouthConnectorDTO extends BaseEntity {
  /**
   * The name of the South connector.
   *
   * @example "Production Data Files"
   */
  name: string;

  /**
   * The type of the South connector.
   *
   * @example "folder-scanner"
   */
  type: OIBusSouthType;

  /**
   * Description of the South connector's purpose.
   *
   * @example "Scans production data CSV files"
   */
  description: string;

  /**
   * Whether the South connector is enabled and active.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * Configuration settings specific to this South connector type.
   *
   * @example
   * {
   *   "inputFolder": "./input",
   *   "compression": true
   * }
   */
  settings: SouthSettings;

  /**
   * List of items (data points) configured for this connector.
   */
  items: Array<SouthConnectorItemDTO>;
}

/**
 * Command Data Transfer Object for creating or updating a South connector.
 * Used as the request body for South connector creation/update endpoints.
 */
export interface SouthConnectorCommandDTO {
  /**
   * The name of the South connector.
   *
   * @example "Production Data Files"
   */
  name: string;

  /**
   * The type of the South connector.
   *
   * @example "folder-scanner"
   */
  type: OIBusSouthType;

  /**
   * Description of the South connector's purpose.
   *
   * @example "Scans production data CSV files"
   */
  description: string;

  /**
   * Whether the South connector should be enabled.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * Configuration settings specific to this South connector type.
   *
   * @example
   * {
   *   "inputFolder": "./input",
   *   "compression": true
   * }
   */
  settings: SouthSettings;

  /**
   * List of items (data points) to configure for this connector.
   */
  items: Array<SouthConnectorItemCommandDTO>;
}

/**
 * Data Transfer Object for an item to query within a South connector.
 * Represents an individual data point or file to be collected.
 */
export interface SouthConnectorItemDTO extends BaseEntity {
  /**
   * The name of the item.
   *
   * @example "Temperature Logs"
   */
  name: string;

  /**
   * Whether this item is enabled and should be collected.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * Item-specific settings for data collection.
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

  /**
   * The scan mode configuration for this item.
   */
  scanMode: ScanModeDTO;
}

/**
 * Command Data Transfer Object for creating or updating a South connector item.
 * Used as the request body for South connector item creation/update endpoints.
 */
export interface SouthConnectorItemCommandDTO {
  /**
   * The ID of the item (null when creating a new item).
   *
   * @example null
   */
  id: string | null;

  /**
   * Whether this item should be enabled.
   *
   * @example true
   */
  enabled: boolean;

  /**
   * The name of the item.
   *
   * @example "Temperature Logs"
   */
  name: string;

  /**
   * Item-specific settings for data collection.
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

  /**
   * The ID of the scan mode to use for this item.
   * Null when the scan mode should be determined by the system.
   *
   * @example "periodic-5min"
   */
  scanModeId: string | null;

  /**
   * The name of the scan mode to use when ID is not available.
   * Null when not specifying by name.
   *
   * @example null
   */
  scanModeName: string | null;
}

/**
 * Settings for testing a South connector item.
 * Used when manually testing data collection for an item.
 *
 * @example
 * {
 *   "history": undefined
 * }
 */
export interface SouthConnectorItemTestingSettings {
  /**
   * Historical data range for testing.
   * Undefined when testing real-time data collection (which for folder-scanner means last file).
   */
  history:
    | {
        /**
         * Start time for historical data test (ISO 8601 format).
         * Not applicable for folder-scanner as it doesn't support history mode.
         */
        startTime: string;

        /**
         * End time for historical data test (ISO 8601 format).
         * Not applicable for folder-scanner as it doesn't support history mode.
         */
        endTime: string;
      }
    | undefined;
}

/**
 * Manifest for a South connector type.
 * Describes the configuration schema, capabilities, and structure of a South connector type.
 */
export interface SouthConnectorManifest {
  /**
   * The unique identifier of the South connector type.
   *
   * @example "folder-scanner"
   */
  id: OIBusSouthType;

  /**
   * The category of the South connector.
   *
   * @example "file"
   */
  category: OIBusSouthCategory;

  /**
   * The operating modes supported by this connector type.
   */
  modes: {
    /**
     * Whether this connector supports real-time subscription mode.
     *
     * @example false
     */
    subscription: boolean;

    /**
     * Whether this connector supports retrieving the last data point.
     *
     * @example false
     */
    lastPoint: boolean;

    /**
     * Whether this connector supports retrieving the last file.
     *
     * @example true
     */
    lastFile: boolean;

    /**
     * Whether this connector supports historical data retrieval.
     *
     * @example false
     */
    history: boolean;
  };

  /**
   * The configuration schema for the connector settings.
   */
  settings: OIBusObjectAttribute;

  /**
   * The configuration schema for items (data points).
   */
  items: OIBusArrayAttribute;
}

/**
 * Cache information for a South connector item.
 * Tracks the latest collected data for an item.
 */
export interface SouthCache {
  /**
   * The ID of the South connector.
   *
   * @example "south-folder-1"
   */
  southId: string;

  /**
   * The ID of the scan mode used for this cached data.
   *
   * @example "periodic-5min"
   */
  scanModeId: string;

  /**
   * The ID of the item this cache entry belongs to.
   *
   * @example "item-1"
   */
  itemId: string;

  /**
   * The timestamp of the most recent data in the cache (ISO 8601 format).
   * For folder-scanner, this represents when the last file was processed.
   *
   * @example "2023-05-15T12:34:56.789Z"
   */
  maxInstant: Instant;
}

/**
 * Search parameters for South connector items.
 * Used for filtering and paginating item lists.
 */
export interface SouthConnectorItemSearchParam {
  /**
   * Name filter for items (partial match).
   * Undefined means no name filtering.
   *
   * @example "temperature"
   */
  name: string | undefined;

  /**
   * Filter by scan mode ID.
   * Undefined means no filtering by scan mode.
   *
   * @example "periodic-5min"
   */
  scanModeId: string | undefined;

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
