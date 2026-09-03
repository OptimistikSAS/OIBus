/* eslint-disable @typescript-eslint/no-empty-object-type */
import { BaseEntity, Instant } from './types';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthFTPItemSettings,
  SouthFTPSettings,
  SouthInfluxDBItemSettings,
  SouthInfluxDBSettings,
  SouthModbusItemSettings,
  SouthModbusSettings,
  SouthMongoDBItemSettings,
  SouthMongoDBSettings,
  SouthMQTTItemSettings,
  SouthMQTTSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthMySQLItemSettings,
  SouthMySQLSettings,
  SouthODBCItemSettings,
  SouthODBCSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings,
  SouthOLEDBItemSettings,
  SouthOLEDBSettings,
  SouthOPCItemSettings,
  SouthOPCSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOracleItemSettings,
  SouthOracleSettings,
  SouthPIItemSettings,
  SouthPISettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings,
  SouthRestItemSettings,
  SouthRestSettings,
  SouthS7ItemSettings,
  SouthS7Settings,
  SouthSFTPItemSettings,
  SouthSFTPSettings,
  SouthSQLiteItemSettings,
  SouthSQLiteSettings
} from './south-settings.model';
import { ScanModeDTO } from './scan-mode.model';
import { OIBusArrayAttribute, OIBusObjectAttribute } from './form.model';
import { OIBusContent } from './engine.model';

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
  'influxdb', // InfluxDB time series database
  'modbus', // Modbus industrial protocol
  'mongodb', // MongoDB document database
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
  'rest', // REST API connector
  's7', // Siemens S7 industrial protocol
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
 * Recovery strategy used when a south connector reconnects after a long disconnection.
 * - 'oldest': fill the gap from oldest to newest (default behaviour).
 * - 'newest': fill the gap from newest to oldest so that recent data arrives first.
 */
export type SouthHistoryRecoveryStrategy = 'oldest' | 'newest';

/**
 * Per-item caching strategy for IoT-family south connectors.
 * - 'allValues': every value read/received is cached (default behaviour).
 * - 'onChange': a value is only cached when it differs from the last cached value.
 * - 'threshold': a value is only cached when it differs from the last cached value by more than a threshold.
 */
export type SouthCachingStrategy = 'allValues' | 'onChange' | 'threshold';

/**
 * The kind of threshold used by the 'threshold' caching strategy.
 * - 'absolute': the threshold is an absolute numeric difference.
 * - 'percentage': the threshold is a percentage of the value's configured range (rangeHigh - rangeLow).
 */
export type SouthCachingThresholdType = 'absolute' | 'percentage';

/**
 * South connector types belonging to the "IoT family" (OPC UA, Modbus, ADS, OPC classic, S7, MQTT), for
 * which per-item caching strategy is available.
 */
export const IOT_FAMILY_SOUTH_TYPES: Array<OIBusSouthType> = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];

/**
 * South connector types whose Configuration Workflow discoveryScope is a dedicated SQL metadata query
 * (`{ query: string }`) rather than a tree root to browse - i.e. the ones with a `discover()`
 * implementation today. ODBC and OLEDB are SQL-family too but route through a separate agent process
 * rather than a driver this repo talks to directly, so they don't have `discover()` yet.
 */
export const SQL_FAMILY_SOUTH_TYPES: Array<OIBusSouthType> = ['mssql', 'mysql', 'postgresql', 'oracle', 'sqlite'];

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
   * Whether this connector type is in beta.
   *
   * @example false
   */
  beta?: boolean;

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

export interface SouthConnectorTypedDTO<T extends OIBusSouthType, S, IS> extends BaseEntity {
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
  type: T;

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
   */
  settings: S;

  /**
   * List of items (data points) configured for this connector.
   */
  items: Array<SouthConnectorItemTypedDTO<IS>>;

  /**
   * List of groups attached to this connector
   */
  groups: Array<SouthItemGroupDTO>;
}

export interface SouthConnectorItemTypedDTO<IS> extends BaseEntity {
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
   */
  settings: IS;

  /**
   * The scan mode configuration for this item.
   */
  scanMode: ScanModeDTO | null;

  /**
   * The group this item belongs to, if any.
   */
  group: SouthItemGroupDTO | null;

  /**
   * Whether this item syncs its historian settings with its group.
   * When true, historian fields (maxReadInterval, readDelay, startTimeOffset, endTimeOffset) are inherited from the group.
   *
   * @example true
   */
  syncWithGroup: boolean;

  /**
   * Maximum read interval in seconds for historical queries.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   *
   * @example 3600
   */
  maxReadInterval: number | null;

  /**
   * Read delay in milliseconds before querying historical data.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   *
   * @example 200
   */
  readDelay: number | null;

  /**
   * Offset in milliseconds applied to the start of the history query interval.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   * Negative values extend the window backwards (equivalent to the old overlap behaviour).
   *
   * @example -1000
   */
  startTimeOffset: number | null;

  /**
   * Offset in milliseconds applied to the end of the history query interval.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   * If the resulting end time is not after the effective start time, the query is skipped.
   *
   * @example 0
   */
  endTimeOffset: number | null;

  /**
   * Recovery strategy when the connector reconnects after a long disconnection.
   * Only applicable for connectors with historian capabilities.
   * When null, defaults to 'oldest'.
   *
   * @example "oldest"
   */
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;

  /**
   * Per-item caching strategy. Only applicable for IoT-family connectors (OPC UA, Modbus, ADS, OPC classic,
   * S7, MQTT).
   * When null and item is in a group, inherits from group settings.
   *
   * @example "onChange"
   */
  cachingStrategy: SouthCachingStrategy | null;

  /**
   * The kind of threshold used by the 'threshold' caching strategy. Only applicable when cachingStrategy is
   * 'threshold'.
   * Always item-local, never inherited from a group.
   *
   * @example "absolute"
   */
  thresholdType: SouthCachingThresholdType | null;

  /**
   * Threshold value used by the 'threshold' caching strategy. Interpreted as an absolute difference or a
   * percentage of the configured range depending on thresholdType.
   * Always item-local, never inherited from a group.
   *
   * @example 1
   */
  threshold: number | null;

  /**
   * Lower bound of the value's expected range, used to compute percentage thresholds.
   * Always item-local, never inherited from a group.
   *
   * @example 0
   */
  rangeLow: number | null;

  /**
   * Upper bound of the value's expected range, used to compute percentage thresholds.
   * Always item-local, never inherited from a group.
   *
   * @example 100
   */
  rangeHigh: number | null;

  /**
   * Maximum interval in milliseconds between two cached values, regardless of the caching strategy, so a
   * stable point still produces periodic proof-of-life data.
   * Always item-local, never inherited from a group.
   *
   * @example 3600000
   */
  maxCachingInterval: number | null;
}

export interface ItemLightDTO extends BaseEntity {
  /**
   * The name of the item.
   *
   * @example "Temperature Logs"
   */
  name: string;

  /**
   * Whether this item is enabled.
   *
   * @example true
   */
  enabled: boolean;
}

export interface SouthItemGroupLightDTO {
  id: string;

  /**
   * The name of the group.
   *
   * @example "Production Line A"
   */
  name: string;
}

/**
 * Data Transfer Object for a South item group.
 * Represents a group of items that can share common settings.
 */
export interface SouthItemGroupDTO extends BaseEntity {
  standardSettings: {
    /**
     * The name of the group.
     *
     * @example "Production Line A"
     */
    name: string;

    /**
     * The scan mode configuration for this group (default schedule).
     */
    scanMode: ScanModeDTO;
  };

  historySettings: {
    /**
     * Offset in milliseconds applied to the start of the history query interval.
     * Only applicable for connectors with historian capabilities.
     * Negative values extend the window backwards (equivalent to the old overlap behaviour).
     *
     * @example -1000
     */
    startTimeOffset: number | null;

    /**
     * Offset in milliseconds applied to the end of the history query interval.
     * Only applicable for connectors with historian capabilities.
     * If the resulting end time is not after the effective start time, the query is skipped.
     *
     * @example 0
     */
    endTimeOffset: number | null;

    /**
     * Maximum read interval in seconds for historical queries.
     * Only applicable for connectors with historian capabilities.
     *
     * @example 3600
     */
    maxReadInterval: number | null;

    /**
     * Read delay in milliseconds before querying historical data.
     * Only applicable for connectors with historian capabilities.
     *
     * @example 200
     */
    readDelay: number | null;

    /**
     * Recovery strategy when the connector reconnects after a long disconnection.
     * Only applicable for connectors with historian capabilities.
     * When null, defaults to 'oldest'.
     *
     * @example "oldest"
     */
    recoveryStrategy: SouthHistoryRecoveryStrategy | null;

    /**
     * Per-item caching strategy inherited by items in this group when they sync with it. Only applicable for
     * IoT-family connectors (OPC UA, Modbus, ADS, OPC classic, S7, MQTT).
     *
     * @example "onChange"
     */
    cachingStrategy: SouthCachingStrategy | null;
  };
}

/**
 * Command Data Transfer Object for creating or updating a South item group.
 */
export interface SouthItemGroupCommandDTO {
  /**
   * The ID of the group (null when creating a new group).
   *
   * @example null
   */
  id: string | null;

  standardSettings: {
    /**
     * The name of the group.
     *
     * @example "Production Line A"
     */
    name: string;

    /**
     * The ID of the scan mode to use for this group.
     *
     * @example "periodic-5min"
     */
    scanModeId: string;
  };

  historySettings: {
    /**
     * Offset in milliseconds applied to the start of the history query interval.
     * Negative values extend the window backwards (equivalent to the old overlap behaviour).
     *
     * @example -1000
     */
    startTimeOffset: number | null;

    /**
     * Offset in milliseconds applied to the end of the history query interval.
     * If the resulting end time is not after the effective start time, the query is skipped.
     *
     * @example 0
     */
    endTimeOffset: number | null;

    /**
     * Maximum read interval in seconds for historical queries.
     *
     * @example 3600
     */
    maxReadInterval: number | null;

    /**
     * Read delay in milliseconds before querying historical data.
     *
     * @example 200
     */
    readDelay: number | null;

    /**
     * Recovery strategy when the connector reconnects after a long disconnection.
     * When null, defaults to 'oldest'.
     *
     * @example "oldest"
     */
    recoveryStrategy: SouthHistoryRecoveryStrategy | null;

    /**
     * Per-item caching strategy inherited by items in this group when they sync with it. Only applicable for
     * IoT-family connectors (OPC UA, Modbus, ADS, OPC classic, S7, MQTT).
     *
     * @example "onChange"
     */
    cachingStrategy: SouthCachingStrategy | null;
  };
}

// ── Named variants (tsoa uses these as schema names) ─────────────────────
/** South connector configuration for Beckhoff ADS. */
export interface SouthConnectorADSDTO extends SouthConnectorTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings> {
  items: Array<SouthConnectorADSItemDTO>;
}
/** South connector configuration for the Folder Scanner. */
export interface SouthConnectorFolderScannerDTO extends SouthConnectorTypedDTO<
  'folder-scanner',
  SouthFolderScannerSettings,
  SouthFolderScannerItemSettings
> {
  items: Array<SouthConnectorFolderScannerItemDTO>;
}
/** South connector configuration for FTP file transfer. */
export interface SouthConnectorFTPDTO extends SouthConnectorTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings> {
  items: Array<SouthConnectorFTPItemDTO>;
}
/** South connector configuration for InfluxDB time series database. */
export interface SouthConnectorInfluxDBDTO extends SouthConnectorTypedDTO<'influxdb', SouthInfluxDBSettings, SouthInfluxDBItemSettings> {
  items: Array<SouthConnectorInfluxDBItemDTO>;
}
/** South connector configuration for Modbus. */
export interface SouthConnectorModbusDTO extends SouthConnectorTypedDTO<'modbus', SouthModbusSettings, SouthModbusItemSettings> {
  items: Array<SouthConnectorModbusItemDTO>;
}
/** South connector configuration for MongoDB. */
export interface SouthConnectorMongoDBDTO extends SouthConnectorTypedDTO<'mongodb', SouthMongoDBSettings, SouthMongoDBItemSettings> {
  items: Array<SouthConnectorMongoDBItemDTO>;
}
/** South connector configuration for MQTT. */
export interface SouthConnectorMQTTDTO extends SouthConnectorTypedDTO<'mqtt', SouthMQTTSettings, SouthMQTTItemSettings> {
  items: Array<SouthConnectorMQTTItemDTO>;
}
/** South connector configuration for Microsoft SQL Server. */
export interface SouthConnectorMSSQLDTO extends SouthConnectorTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings> {
  items: Array<SouthConnectorMSSQLItemDTO>;
}
/** South connector configuration for MySQL. */
export interface SouthConnectorMySQLDTO extends SouthConnectorTypedDTO<'mysql', SouthMySQLSettings, SouthMySQLItemSettings> {
  items: Array<SouthConnectorMySQLItemDTO>;
}
/** South connector configuration for ODBC. */
export interface SouthConnectorODBCDTO extends SouthConnectorTypedDTO<'odbc', SouthODBCSettings, SouthODBCItemSettings> {
  items: Array<SouthConnectorODBCItemDTO>;
}
/** South connector configuration for OIAnalytics. */
export interface SouthConnectorOIAnalyticsDTO extends SouthConnectorTypedDTO<
  'oianalytics',
  SouthOIAnalyticsSettings,
  SouthOIAnalyticsItemSettings
> {
  items: Array<SouthConnectorOIAnalyticsItemDTO>;
}
/** South connector configuration for OLE DB. */
export interface SouthConnectorOLEDBDTO extends SouthConnectorTypedDTO<'oledb', SouthOLEDBSettings, SouthOLEDBItemSettings> {
  items: Array<SouthConnectorOLEDBItemDTO>;
}
/** South connector configuration for classic OPC (OLE for Process Control). */
export interface SouthConnectorOPCDTO extends SouthConnectorTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings> {
  items: Array<SouthConnectorOPCItemDTO>;
}
/** South connector configuration for OPC UA. */
export interface SouthConnectorOPCUADTO extends SouthConnectorTypedDTO<'opcua', SouthOPCUASettings, SouthOPCUAItemSettings> {
  items: Array<SouthConnectorOPCUAItemDTO>;
}
/** South connector configuration for Oracle Database. */
export interface SouthConnectorOracleDTO extends SouthConnectorTypedDTO<'oracle', SouthOracleSettings, SouthOracleItemSettings> {
  items: Array<SouthConnectorOracleItemDTO>;
}
/** South connector configuration for OSIsoft PI System. */
export interface SouthConnectorOsisoftPIDTO extends SouthConnectorTypedDTO<'osisoft-pi', SouthPISettings, SouthPIItemSettings> {
  items: Array<SouthConnectorOsisoftPIItemDTO>;
}
/** South connector configuration for PostgreSQL. */
export interface SouthConnectorPostgreSQLDTO extends SouthConnectorTypedDTO<
  'postgresql',
  SouthPostgreSQLSettings,
  SouthPostgreSQLItemSettings
> {
  items: Array<SouthConnectorPostgreSQLItemDTO>;
}
/** South connector configuration for the REST API. */
export interface SouthConnectorRESTDTO extends SouthConnectorTypedDTO<'rest', SouthRestSettings, SouthRestItemSettings> {
  items: Array<SouthConnectorRESTItemDTO>;
}
/** South connector configuration for Siemens S7. */
export interface SouthConnectorS7DTO extends SouthConnectorTypedDTO<'s7', SouthS7Settings, SouthS7ItemSettings> {
  items: Array<SouthConnectorS7ItemDTO>;
}
/** South connector configuration for SFTP file transfer. */
export interface SouthConnectorSFTPDTO extends SouthConnectorTypedDTO<'sftp', SouthSFTPSettings, SouthSFTPItemSettings> {
  items: Array<SouthConnectorSFTPItemDTO>;
}
/** South connector configuration for SQLite. */
export interface SouthConnectorSQLiteDTO extends SouthConnectorTypedDTO<'sqlite', SouthSQLiteSettings, SouthSQLiteItemSettings> {
  items: Array<SouthConnectorSQLiteItemDTO>;
}

/**
 * Data Transfer Object for a South connector.
 * Contains all configuration details and current state of a South connector.
 */
export type SouthConnectorDTO =
  | SouthConnectorADSDTO
  | SouthConnectorFolderScannerDTO
  | SouthConnectorFTPDTO
  | SouthConnectorInfluxDBDTO
  | SouthConnectorModbusDTO
  | SouthConnectorMongoDBDTO
  | SouthConnectorMQTTDTO
  | SouthConnectorMSSQLDTO
  | SouthConnectorMySQLDTO
  | SouthConnectorODBCDTO
  | SouthConnectorOIAnalyticsDTO
  | SouthConnectorOLEDBDTO
  | SouthConnectorOPCDTO
  | SouthConnectorOPCUADTO
  | SouthConnectorOracleDTO
  | SouthConnectorOsisoftPIDTO
  | SouthConnectorPostgreSQLDTO
  | SouthConnectorRESTDTO
  | SouthConnectorS7DTO
  | SouthConnectorSFTPDTO
  | SouthConnectorSQLiteDTO;

export interface SouthConnectorCommandTypedDTO<T extends OIBusSouthType, S, IS> {
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
  type: T;

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
   */
  settings: S;

  /**
   * List of items (data points) to configure for this connector.
   */
  items: Array<SouthConnectorItemCommandTypedDTO<IS>>;

  /**
   * List of groups used to gather items
   */
  groups: Array<SouthItemGroupCommandDTO>;
}

export interface SouthConnectorItemCommandTypedDTO<IS> {
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
   */
  settings: IS;

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

  /**
   * The ID of the group this item belongs to.
   * Null when the item is not in any group.
   *
   * @example "group-123"
   */
  groupId: string | null;

  /**
   * The name of the group this item belongs to.
   * Used when importing from CSV where group IDs are not available.
   * Null when the item is not in any group.
   *
   * @example "Production Line A"
   */
  groupName: string | null;

  /**
   * Whether this item syncs its historian settings with its group.
   * When true, historian fields are inherited from the group.
   *
   * @example true
   */
  syncWithGroup: boolean;

  /**
   * Maximum read interval in seconds for historical queries.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   *
   * @example 3600
   */
  maxReadInterval: number | null;

  /**
   * Read delay in milliseconds before querying historical data.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   *
   * @example 200
   */
  readDelay: number | null;

  /**
   * Offset in milliseconds applied to the start of the history query interval.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   * Negative values extend the window backwards (equivalent to the old overlap behaviour).
   *
   * @example -1000
   */
  startTimeOffset: number | null;

  /**
   * Offset in milliseconds applied to the end of the history query interval.
   * Only applicable for connectors with historian capabilities.
   * When null and item is in a group, inherits from group settings.
   * If the resulting end time is not after the effective start time, the query is skipped.
   *
   * @example 0
   */
  endTimeOffset: number | null;

  /**
   * Recovery strategy when the connector reconnects after a long disconnection.
   * Only applicable for connectors with historian capabilities.
   * When null, defaults to 'oldest'.
   *
   * @example "oldest"
   */
  recoveryStrategy: SouthHistoryRecoveryStrategy | null;

  /**
   * Per-item caching strategy. Only applicable for IoT-family connectors (OPC UA, Modbus, ADS, OPC classic,
   * S7, MQTT).
   * When null and item is in a group, inherits from group settings.
   *
   * @example "onChange"
   */
  cachingStrategy: SouthCachingStrategy | null;

  /**
   * The kind of threshold used by the 'threshold' caching strategy. Only applicable when cachingStrategy is
   * 'threshold'.
   * Always item-local, never inherited from a group.
   *
   * @example "absolute"
   */
  thresholdType: SouthCachingThresholdType | null;

  /**
   * Threshold value used by the 'threshold' caching strategy. Interpreted as an absolute difference or a
   * percentage of the configured range depending on thresholdType.
   * Always item-local, never inherited from a group.
   *
   * @example 1
   */
  threshold: number | null;

  /**
   * Lower bound of the value's expected range, used to compute percentage thresholds.
   * Always item-local, never inherited from a group.
   *
   * @example 0
   */
  rangeLow: number | null;

  /**
   * Upper bound of the value's expected range, used to compute percentage thresholds.
   * Always item-local, never inherited from a group.
   *
   * @example 100
   */
  rangeHigh: number | null;

  /**
   * Maximum interval in milliseconds between two cached values, regardless of the caching strategy, so a
   * stable point still produces periodic proof-of-life data.
   * Always item-local, never inherited from a group.
   *
   * @example 3600000
   */
  maxCachingInterval: number | null;
}

// ── Named command variants (tsoa uses these as schema names) ──────────────
/** South connector command for Beckhoff ADS. */
export interface SouthConnectorADSCommandDTO extends SouthConnectorCommandTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings> {
  items: Array<SouthConnectorADSItemCommandDTO>;
}
/** South connector command for the Folder Scanner. */
export interface SouthConnectorFolderScannerCommandDTO extends SouthConnectorCommandTypedDTO<
  'folder-scanner',
  SouthFolderScannerSettings,
  SouthFolderScannerItemSettings
> {
  items: Array<SouthConnectorFolderScannerItemCommandDTO>;
}
/** South connector command for FTP file transfer. */
export interface SouthConnectorFTPCommandDTO extends SouthConnectorCommandTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings> {
  items: Array<SouthConnectorFTPItemCommandDTO>;
}
/** South connector command for InfluxDB time series database. */
export interface SouthConnectorInfluxDBCommandDTO extends SouthConnectorCommandTypedDTO<
  'influxdb',
  SouthInfluxDBSettings,
  SouthInfluxDBItemSettings
> {
  items: Array<SouthConnectorInfluxDBItemCommandDTO>;
}
/** South connector command for Modbus. */
export interface SouthConnectorModbusCommandDTO extends SouthConnectorCommandTypedDTO<
  'modbus',
  SouthModbusSettings,
  SouthModbusItemSettings
> {
  items: Array<SouthConnectorModbusItemCommandDTO>;
}
/** South connector command for MongoDB. */
export interface SouthConnectorMongoDBCommandDTO extends SouthConnectorCommandTypedDTO<
  'mongodb',
  SouthMongoDBSettings,
  SouthMongoDBItemSettings
> {
  items: Array<SouthConnectorMongoDBItemCommandDTO>;
}
/** South connector command for MQTT. */
export interface SouthConnectorMQTTCommandDTO extends SouthConnectorCommandTypedDTO<'mqtt', SouthMQTTSettings, SouthMQTTItemSettings> {
  items: Array<SouthConnectorMQTTItemCommandDTO>;
}
/** South connector command for Microsoft SQL Server. */
export interface SouthConnectorMSSQLCommandDTO extends SouthConnectorCommandTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings> {
  items: Array<SouthConnectorMSSQLItemCommandDTO>;
}
/** South connector command for MySQL. */
export interface SouthConnectorMySQLCommandDTO extends SouthConnectorCommandTypedDTO<'mysql', SouthMySQLSettings, SouthMySQLItemSettings> {
  items: Array<SouthConnectorMySQLItemCommandDTO>;
}
/** South connector command for ODBC. */
export interface SouthConnectorODBCCommandDTO extends SouthConnectorCommandTypedDTO<'odbc', SouthODBCSettings, SouthODBCItemSettings> {
  items: Array<SouthConnectorODBCItemCommandDTO>;
}
/** South connector command for OIAnalytics. */
export interface SouthConnectorOIAnalyticsCommandDTO extends SouthConnectorCommandTypedDTO<
  'oianalytics',
  SouthOIAnalyticsSettings,
  SouthOIAnalyticsItemSettings
> {
  items: Array<SouthConnectorOIAnalyticsItemCommandDTO>;
}
/** South connector command for OLE DB. */
export interface SouthConnectorOLEDBCommandDTO extends SouthConnectorCommandTypedDTO<'oledb', SouthOLEDBSettings, SouthOLEDBItemSettings> {
  items: Array<SouthConnectorOLEDBItemCommandDTO>;
}
/** South connector command for classic OPC (OLE for Process Control). */
export interface SouthConnectorOPCCommandDTO extends SouthConnectorCommandTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings> {
  items: Array<SouthConnectorOPCItemCommandDTO>;
}
/** South connector command for OPC UA. */
export interface SouthConnectorOPCUACommandDTO extends SouthConnectorCommandTypedDTO<'opcua', SouthOPCUASettings, SouthOPCUAItemSettings> {
  items: Array<SouthConnectorOPCUAItemCommandDTO>;
}
/** South connector command for Oracle Database. */
export interface SouthConnectorOracleCommandDTO extends SouthConnectorCommandTypedDTO<
  'oracle',
  SouthOracleSettings,
  SouthOracleItemSettings
> {
  items: Array<SouthConnectorOracleItemCommandDTO>;
}
/** South connector command for OSIsoft PI System. */
export interface SouthConnectorOsisoftPICommandDTO extends SouthConnectorCommandTypedDTO<
  'osisoft-pi',
  SouthPISettings,
  SouthPIItemSettings
> {
  items: Array<SouthConnectorOsisoftPIItemCommandDTO>;
}
/** South connector command for PostgreSQL. */
export interface SouthConnectorPostgreSQLCommandDTO extends SouthConnectorCommandTypedDTO<
  'postgresql',
  SouthPostgreSQLSettings,
  SouthPostgreSQLItemSettings
> {
  items: Array<SouthConnectorPostgreSQLItemCommandDTO>;
}
/** South connector command for the REST API. */
export interface SouthConnectorRESTCommandDTO extends SouthConnectorCommandTypedDTO<'rest', SouthRestSettings, SouthRestItemSettings> {
  items: Array<SouthConnectorRESTItemCommandDTO>;
}
/** South connector command for Siemens S7. */
export interface SouthConnectorS7CommandDTO extends SouthConnectorCommandTypedDTO<'s7', SouthS7Settings, SouthS7ItemSettings> {
  items: Array<SouthConnectorS7ItemCommandDTO>;
}
/** South connector command for SFTP file transfer. */
export interface SouthConnectorSFTPCommandDTO extends SouthConnectorCommandTypedDTO<'sftp', SouthSFTPSettings, SouthSFTPItemSettings> {
  items: Array<SouthConnectorSFTPItemCommandDTO>;
}
/** South connector command for SQLite. */
export interface SouthConnectorSQLiteCommandDTO extends SouthConnectorCommandTypedDTO<
  'sqlite',
  SouthSQLiteSettings,
  SouthSQLiteItemSettings
> {
  items: Array<SouthConnectorSQLiteItemCommandDTO>;
}

/**
 * Command Data Transfer Object for creating or updating a South connector.
 * Used as the request body for South connector creation/update endpoints.
 */
export type SouthConnectorCommandDTO =
  | SouthConnectorADSCommandDTO
  | SouthConnectorFolderScannerCommandDTO
  | SouthConnectorFTPCommandDTO
  | SouthConnectorInfluxDBCommandDTO
  | SouthConnectorModbusCommandDTO
  | SouthConnectorMongoDBCommandDTO
  | SouthConnectorMQTTCommandDTO
  | SouthConnectorMSSQLCommandDTO
  | SouthConnectorMySQLCommandDTO
  | SouthConnectorODBCCommandDTO
  | SouthConnectorOIAnalyticsCommandDTO
  | SouthConnectorOLEDBCommandDTO
  | SouthConnectorOPCCommandDTO
  | SouthConnectorOPCUACommandDTO
  | SouthConnectorOracleCommandDTO
  | SouthConnectorOsisoftPICommandDTO
  | SouthConnectorPostgreSQLCommandDTO
  | SouthConnectorRESTCommandDTO
  | SouthConnectorS7CommandDTO
  | SouthConnectorSFTPCommandDTO
  | SouthConnectorSQLiteCommandDTO;

// ── Named item DTO variants (tsoa uses these as schema names) ────────────
/** South connector item DTO for Beckhoff ADS. */
export interface SouthConnectorADSItemDTO extends SouthConnectorItemTypedDTO<SouthADSItemSettings> {}
/** South connector item DTO for the Folder Scanner. */
export interface SouthConnectorFolderScannerItemDTO extends SouthConnectorItemTypedDTO<SouthFolderScannerItemSettings> {}
/** South connector item DTO for FTP file transfer. */
export interface SouthConnectorFTPItemDTO extends SouthConnectorItemTypedDTO<SouthFTPItemSettings> {}
/** South connector item DTO for InfluxDB time series database. */
export interface SouthConnectorInfluxDBItemDTO extends SouthConnectorItemTypedDTO<SouthInfluxDBItemSettings> {}
/** South connector item DTO for Modbus. */
export interface SouthConnectorModbusItemDTO extends SouthConnectorItemTypedDTO<SouthModbusItemSettings> {}
/** South connector item DTO for MongoDB. */
export interface SouthConnectorMongoDBItemDTO extends SouthConnectorItemTypedDTO<SouthMongoDBItemSettings> {}
/** South connector item DTO for MQTT. */
export interface SouthConnectorMQTTItemDTO extends SouthConnectorItemTypedDTO<SouthMQTTItemSettings> {}
/** South connector item DTO for Microsoft SQL Server. */
export interface SouthConnectorMSSQLItemDTO extends SouthConnectorItemTypedDTO<SouthMSSQLItemSettings> {}
/** South connector item DTO for MySQL. */
export interface SouthConnectorMySQLItemDTO extends SouthConnectorItemTypedDTO<SouthMySQLItemSettings> {}
/** South connector item DTO for ODBC. */
export interface SouthConnectorODBCItemDTO extends SouthConnectorItemTypedDTO<SouthODBCItemSettings> {}
/** South connector item DTO for OIAnalytics. */
export interface SouthConnectorOIAnalyticsItemDTO extends SouthConnectorItemTypedDTO<SouthOIAnalyticsItemSettings> {}
/** South connector item DTO for OLE DB. */
export interface SouthConnectorOLEDBItemDTO extends SouthConnectorItemTypedDTO<SouthOLEDBItemSettings> {}
/** South connector item DTO for classic OPC (OLE for Process Control). */
export interface SouthConnectorOPCItemDTO extends SouthConnectorItemTypedDTO<SouthOPCItemSettings> {}
/** South connector item DTO for OPC UA. */
export interface SouthConnectorOPCUAItemDTO extends SouthConnectorItemTypedDTO<SouthOPCUAItemSettings> {}
/** South connector item DTO for Oracle Database. */
export interface SouthConnectorOracleItemDTO extends SouthConnectorItemTypedDTO<SouthOracleItemSettings> {}
/** South connector item DTO for OSIsoft PI System. */
export interface SouthConnectorOsisoftPIItemDTO extends SouthConnectorItemTypedDTO<SouthPIItemSettings> {}
/** South connector item DTO for PostgreSQL. */
export interface SouthConnectorPostgreSQLItemDTO extends SouthConnectorItemTypedDTO<SouthPostgreSQLItemSettings> {}
/** South connector item DTO for the REST API. */
export interface SouthConnectorRESTItemDTO extends SouthConnectorItemTypedDTO<SouthRestItemSettings> {}
/** South connector item DTO for SFTP file transfer. */
export interface SouthConnectorSFTPItemDTO extends SouthConnectorItemTypedDTO<SouthSFTPItemSettings> {}
/** South connector item DTO for Siemens S7. */
export interface SouthConnectorS7ItemDTO extends SouthConnectorItemTypedDTO<SouthS7ItemSettings> {}
/** South connector item DTO for SQLite. */
export interface SouthConnectorSQLiteItemDTO extends SouthConnectorItemTypedDTO<SouthSQLiteItemSettings> {}

/**
 * Data Transfer Object for an item to query within a South connector.
 * Represents an individual data point or file to be collected.
 */
export type SouthConnectorItemDTO =
  | SouthConnectorADSItemDTO
  | SouthConnectorFolderScannerItemDTO
  | SouthConnectorFTPItemDTO
  | SouthConnectorInfluxDBItemDTO
  | SouthConnectorModbusItemDTO
  | SouthConnectorMongoDBItemDTO
  | SouthConnectorMQTTItemDTO
  | SouthConnectorMSSQLItemDTO
  | SouthConnectorMySQLItemDTO
  | SouthConnectorODBCItemDTO
  | SouthConnectorOIAnalyticsItemDTO
  | SouthConnectorOLEDBItemDTO
  | SouthConnectorOPCItemDTO
  | SouthConnectorOPCUAItemDTO
  | SouthConnectorOracleItemDTO
  | SouthConnectorOsisoftPIItemDTO
  | SouthConnectorPostgreSQLItemDTO
  | SouthConnectorRESTItemDTO
  | SouthConnectorS7ItemDTO
  | SouthConnectorSFTPItemDTO
  | SouthConnectorSQLiteItemDTO;

// ── Named item command variants (tsoa uses these as schema names) ─────────
/** South connector item command for Beckhoff ADS. */
export interface SouthConnectorADSItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthADSItemSettings> {}
/** South connector item command for the Folder Scanner. */
export interface SouthConnectorFolderScannerItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthFolderScannerItemSettings> {}
/** South connector item command for FTP file transfer. */
export interface SouthConnectorFTPItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthFTPItemSettings> {}
/** South connector item command for InfluxDB time series database. */
export interface SouthConnectorInfluxDBItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthInfluxDBItemSettings> {}
/** South connector item command for Modbus. */
export interface SouthConnectorModbusItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthModbusItemSettings> {}
/** South connector item command for MongoDB. */
export interface SouthConnectorMongoDBItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthMongoDBItemSettings> {}
/** South connector item command for MQTT. */
export interface SouthConnectorMQTTItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthMQTTItemSettings> {}
/** South connector item command for Microsoft SQL Server. */
export interface SouthConnectorMSSQLItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthMSSQLItemSettings> {}
/** South connector item command for MySQL. */
export interface SouthConnectorMySQLItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthMySQLItemSettings> {}
/** South connector item command for ODBC. */
export interface SouthConnectorODBCItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthODBCItemSettings> {}
/** South connector item command for OIAnalytics. */
export interface SouthConnectorOIAnalyticsItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthOIAnalyticsItemSettings> {}
/** South connector item command for OLE DB. */
export interface SouthConnectorOLEDBItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthOLEDBItemSettings> {}
/** South connector item command for classic OPC (OLE for Process Control). */
export interface SouthConnectorOPCItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthOPCItemSettings> {}
/** South connector item command for OPC UA. */
export interface SouthConnectorOPCUAItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthOPCUAItemSettings> {}
/** South connector item command for Oracle Database. */
export interface SouthConnectorOracleItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthOracleItemSettings> {}
/** South connector item command for OSIsoft PI System. */
export interface SouthConnectorOsisoftPIItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthPIItemSettings> {}
/** South connector item command for PostgreSQL. */
export interface SouthConnectorPostgreSQLItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthPostgreSQLItemSettings> {}
/** South connector item command for the REST API. */
export interface SouthConnectorRESTItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthRestItemSettings> {}
/** South connector item command for Siemens S7. */
export interface SouthConnectorS7ItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthS7ItemSettings> {}
/** South connector item command for SFTP file transfer. */
export interface SouthConnectorSFTPItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthSFTPItemSettings> {}
/** South connector item command for SQLite. */
export interface SouthConnectorSQLiteItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthSQLiteItemSettings> {}

/**
 * Command Data Transfer Object for creating or updating a South connector item.
 * Used as the request body for South connector item creation/update endpoints.
 */
export type SouthConnectorItemCommandDTO =
  | SouthConnectorADSItemCommandDTO
  | SouthConnectorFolderScannerItemCommandDTO
  | SouthConnectorFTPItemCommandDTO
  | SouthConnectorInfluxDBItemCommandDTO
  | SouthConnectorModbusItemCommandDTO
  | SouthConnectorMongoDBItemCommandDTO
  | SouthConnectorMQTTItemCommandDTO
  | SouthConnectorMSSQLItemCommandDTO
  | SouthConnectorMySQLItemCommandDTO
  | SouthConnectorODBCItemCommandDTO
  | SouthConnectorOIAnalyticsItemCommandDTO
  | SouthConnectorOLEDBItemCommandDTO
  | SouthConnectorOPCItemCommandDTO
  | SouthConnectorOPCUAItemCommandDTO
  | SouthConnectorOracleItemCommandDTO
  | SouthConnectorOsisoftPIItemCommandDTO
  | SouthConnectorPostgreSQLItemCommandDTO
  | SouthConnectorRESTItemCommandDTO
  | SouthConnectorS7ItemCommandDTO
  | SouthConnectorSFTPItemCommandDTO
  | SouthConnectorSQLiteItemCommandDTO;

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

  /**
   * Optional transformer to run the raw test result through before returning it.
   * When omitted, the raw collected value is returned (default behavior).
   * `transformerId` references a transformer in the global catalog; `options` are the
   * per-binding options to apply.
   */
  transformer?: {
    transformerId: string;
    options: Record<string, unknown>;
  };
}

/**
 * What a South connector's `testItem()` returns: the collected content, plus how long it took to
 * connect to the source (0 when an already-open connection was reused) and how long the query/read
 * itself took. Lets the UI/OIAnalytics distinguish a slow connection from a slow query.
 */
export interface SouthConnectorItemQueryResult {
  result: OIBusContent;
  connectionDuration: number;
  queryDuration: number;
}

/**
 * Result of testing a South/History item. `raw` is always the value collected by the connector;
 * `transformed` is the output of running `raw` through the selected transformer with its options,
 * or null when no transformer was requested. This lets the UI show the Raw → transformer → Output pipeline.
 * `connectionDuration`/`queryDuration` are passed through from the connector's `SouthConnectorItemQueryResult`.
 */
export interface SouthConnectorItemTestResult {
  raw: OIBusContent;
  transformed: OIBusContent | null;
  connectionDuration: number;
  queryDuration: number;
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
   * Whether this connector type is in beta.
   *
   * @example false
   */
  beta?: boolean;

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
   * Whether this connector type supports the interactive "explore/discovery" feature
   * (browsing the data source, e.g. expanding OPC-UA nodes or walking a folder tree).
   * UI capability flag — mirrors the connector's structural `hasExplore()`.
   *
   * @example true
   */
  explore?: boolean;

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
 * A single entry returned while exploring/discovering a South connector's data source.
 * Represents an OPC-UA node or a file-system entry. Kept intentionally generic and
 * extensible so item creation and item synchronisation can build on it later.
 */
export interface SouthConnectorExploreEntry {
  /**
   * Stable identifier of the entry, passed back to expand it.
   * OPC-UA node id (e.g. "ns=1;s=Temperature") or a folder-relative path.
   */
  id: string;

  /**
   * Human-readable label (OPC-UA display name or file/folder name).
   */
  name: string;

  /**
   * Additional data linked to the entry
   */
  metadata: Record<string, string | number>;

  /**
   * Optional per-field rendering hint for {@link metadata} — a `metadata` key listed here should be
   * displayed with the matching format (e.g. a localized date/time, a human-readable byte size) instead
   * of as plain text. A key with no entry here (the common case — units, counts, types, ...) just
   * renders as-is.
   */
  metadataKinds?: Partial<Record<string, SouthConnectorExploreFieldKind>>;

  /**
   * Whether the entry can be expanded to reveal children in the explore tree.
   */
  hasChildren: boolean;
}

/**
 * How a {@link SouthConnectorExploreEntry.metadata} field should be displayed — see
 * {@link SouthConnectorExploreEntry.metadataKinds}.
 */
export type SouthConnectorExploreFieldKind = 'instant' | 'size';

/**
 * Result of starting an explore session.
 */
export interface SouthExploreStartResult {
  /**
   * Identifier of the stateful explore session, used for subsequent browse/close calls.
   */
  sessionId: string;

  /**
   * The root-level entries of the data source.
   */
  entries: Array<SouthConnectorExploreEntry>;
}

/**
 * Result of browsing (expanding) an entry within an explore session.
 */
export interface SouthExploreBrowseResult {
  /**
   * The children of the browsed entry.
   */
  entries: Array<SouthConnectorExploreEntry>;
}

/**
 * Command body to browse (expand) an entry within an explore session.
 */
export interface SouthExploreBrowseCommand {
  /**
   * The id of the entry to expand, or null to (re)load the root level.
   */
  parentId: string | null;
}

/**
 * Last value information for a South connector item.
 * Stores the last received value and metadata per item.
 */
export interface SouthItemLastValue {
  /**
   * The ID of the item.
   *
   * @example "item-123"
   */
  itemId: string;

  /**
   * The name of the item.
   *
   * @example "Temperature Sensor 1"
   */
  itemName: string;

  /**
   * The ID of the group.
   *
   * @example "group-123"
   */
  groupId: string | null;

  /**
   * The name of the group.
   *
   * @example "Temperature Group"
   */
  groupName: string;

  /**
   * The timestamp when the data was last queried (ISO 8601 format).
   *
   * @example "2024-02-02T12:00:00.000Z"
   */
  queryTime: Instant | null;

  /**
   * The cached value (JSON-serialized, structure depends on connector type).
   * For file-based connectors: array of {filename, modifiedTime}
   * For history connectors: {maxInstant}
   */
  value: unknown;

  /**
   * The tracked instant from group/item (ISO 8601 format).
   * Can be null for non-history connectors.
   *
   * @example "2024-02-02T12:00:00.000Z"
   */
  trackedInstant: Instant | null;
}

/**
 * Response for the item last-value endpoint.
 * Carries the item's own last cached value/instant, plus, when the item belongs to a group,
 * the group's last tracked instant. Both parts reuse {@link SouthItemLastValue} unchanged.
 */
export interface SouthItemLastValueResponse {
  /**
   * The item's own last cached value/instant, or null when nothing has been cached yet for it.
   */
  itemLastValue: SouthItemLastValue | null;

  /**
   * The group's last tracked value/instant when the item belongs to a group, otherwise null.
   */
  groupLastValue: SouthItemLastValue | null;
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
  name?: string;

  /**
   * Filter by scan mode ID.
   * Undefined means no filtering by scan mode.
   *
   * @example "periodic-5min"
   */
  scanModeId?: string;

  /**
   * Filter by enabled status.
   * Undefined means no filtering by enabled status.
   *
   * @example true
   */
  enabled?: boolean;

  /**
   * Page number for pagination (0-based index).
   *
   * @example 0
   */
  page: number;
}

export const SOUTH_SINGLE_ITEMS: Array<OIBusSouthType> = [
  'folder-scanner',
  'ftp',
  'influxdb',
  'mssql',
  'mysql',
  'odbc',
  'oianalytics',
  'oledb',
  'oracle',
  'postgresql',
  'rest',
  'sftp',
  'sqlite'
];
