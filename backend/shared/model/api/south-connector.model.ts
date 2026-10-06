/* eslint-disable @typescript-eslint/no-empty-object-type */
import { OIBusContent } from '../common/content.model';
import { BaseEntity } from '../common/types';
import { OIBusSouthType } from '../connector/south-manifest.model';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthBACnetItemSettings,
  SouthBACnetSettings,
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
} from '../connector/south-settings.model';
import {
  SouthCachingStrategy,
  SouthCachingThresholdType,
  SouthConnectorExploreEntry,
  SouthHistoryRecoveryStrategy,
  SouthItemLastValue
} from '../domain/south-connector.model';
import { ConfigurationWorkflowCommandDTO } from './configuration-workflow.model';
import { ScanModeDTO } from './scan-mode.model';

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
/** South connector configuration for BACnet/IP. */
export interface SouthConnectorBACnetDTO extends SouthConnectorTypedDTO<'bacnet', SouthBACnetSettings, SouthBACnetItemSettings> {
  items: Array<SouthConnectorBACnetItemDTO>;
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
  | SouthConnectorBACnetDTO
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

  /**
   * Configuration workflows of this connector. Workflows missing from this list are deleted, those
   * with an id matching one of the connector's existing workflows are updated, and the others are
   * created.
   */
  configurationWorkflows: Array<ConfigurationWorkflowCommandDTO>;
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
/** South connector command for BACnet/IP. */
export interface SouthConnectorBACnetCommandDTO extends SouthConnectorCommandTypedDTO<
  'bacnet',
  SouthBACnetSettings,
  SouthBACnetItemSettings
> {
  items: Array<SouthConnectorBACnetItemCommandDTO>;
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
  | SouthConnectorBACnetCommandDTO
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
/** South connector item DTO for BACnet/IP. */
export interface SouthConnectorBACnetItemDTO extends SouthConnectorItemTypedDTO<SouthBACnetItemSettings> {}
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
  | SouthConnectorBACnetItemDTO
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
/** South connector item command for BACnet/IP. */
export interface SouthConnectorBACnetItemCommandDTO extends SouthConnectorItemCommandTypedDTO<SouthBACnetItemSettings> {}
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
  | SouthConnectorBACnetItemCommandDTO
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
