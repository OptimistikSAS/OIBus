import { BaseEntity } from './types';
import { OIBusNorthType } from './north-connector.model';
import { OIBusSouthType } from './south-connector.model';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthFTPItemSettings,
  SouthFTPSettings,
  SouthModbusItemSettings,
  SouthModbusSettings,
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
  SouthSFTPItemSettings,
  SouthSFTPSettings,
  SouthSQLiteItemSettings,
  SouthSQLiteSettings
} from './south-settings.model';
import {
  NorthAmazonS3Settings,
  NorthAzureBlobSettings,
  NorthConsoleSettings,
  NorthFileWriterSettings,
  NorthModbusSettings,
  NorthMQTTSettings,
  NorthOIAnalyticsSettings,
  NorthOPCUASettings,
  NorthRESTSettings,
  NorthSFTPSettings
} from './north-settings.model';
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

export interface HistoryQueryCommonDTO {
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
   * List of transformers to apply to data before sending to North connector.
   */
  northTransformers: Array<TransformerDTOWithOptions>;
}

export interface HistoryQuerySouthTypedDTO<T extends OIBusSouthType, S, IS> {
  southType: T;
  southSettings: S;
  items: Array<HistoryQueryItemTypedDTO<IS>>;
}

export interface HistoryQueryNorthTypedDTO<T extends OIBusNorthType, S> {
  northType: T;
  northSettings: S;
}

export interface HistoryQueryItemTypedDTO<IS> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: IS;
}

export type HistoryQueryDTO = BaseEntity &
  HistoryQueryCommonDTO &
  (
    | HistoryQuerySouthTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings>
    | HistoryQuerySouthTypedDTO<'folder-scanner', SouthFolderScannerSettings, SouthFolderScannerItemSettings>
    | HistoryQuerySouthTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings>
    | HistoryQuerySouthTypedDTO<'modbus', SouthModbusSettings, SouthModbusItemSettings>
    | HistoryQuerySouthTypedDTO<'mqtt', SouthMQTTSettings, SouthMQTTItemSettings>
    | HistoryQuerySouthTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings>
    | HistoryQuerySouthTypedDTO<'mysql', SouthMySQLSettings, SouthMySQLItemSettings>
    | HistoryQuerySouthTypedDTO<'odbc', SouthODBCSettings, SouthODBCItemSettings>
    | HistoryQuerySouthTypedDTO<'oianalytics', SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>
    | HistoryQuerySouthTypedDTO<'oledb', SouthOLEDBSettings, SouthOLEDBItemSettings>
    | HistoryQuerySouthTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings>
    | HistoryQuerySouthTypedDTO<'opcua', SouthOPCUASettings, SouthOPCUAItemSettings>
    | HistoryQuerySouthTypedDTO<'oracle', SouthOracleSettings, SouthOracleItemSettings>
    | HistoryQuerySouthTypedDTO<'osisoft-pi', SouthPISettings, SouthPIItemSettings>
    | HistoryQuerySouthTypedDTO<'postgresql', SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
    | HistoryQuerySouthTypedDTO<'sftp', SouthSFTPSettings, SouthSFTPItemSettings>
    | HistoryQuerySouthTypedDTO<'sqlite', SouthSQLiteSettings, SouthSQLiteItemSettings>
  ) &
  (
    | HistoryQueryNorthTypedDTO<'aws-s3', NorthAmazonS3Settings>
    | HistoryQueryNorthTypedDTO<'azure-blob', NorthAzureBlobSettings>
    | HistoryQueryNorthTypedDTO<'console', NorthConsoleSettings>
    | HistoryQueryNorthTypedDTO<'file-writer', NorthFileWriterSettings>
    | HistoryQueryNorthTypedDTO<'modbus', NorthModbusSettings>
    | HistoryQueryNorthTypedDTO<'mqtt', NorthMQTTSettings>
    | HistoryQueryNorthTypedDTO<'oianalytics', NorthOIAnalyticsSettings>
    | HistoryQueryNorthTypedDTO<'opcua', NorthOPCUASettings>
    | HistoryQueryNorthTypedDTO<'rest', NorthRESTSettings>
    | HistoryQueryNorthTypedDTO<'sftp', NorthSFTPSettings>
  );

export interface HistoryQueryCommandCommonDTO {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  caching: {
    trigger: {
      scanModeId: string;
      scanModeName: string | null;
      numberOfElements: number;
      numberOfFiles: number;
    };
    throttling: {
      runMinDelay: number;
      maxSize: number;
      maxNumberOfElements: number;
    };
    error: {
      retryInterval: number;
      retryCount: number;
      retentionDuration: number;
    };
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
  };
  northTransformers: Array<TransformerIdWithOptions>;
}

export interface HistoryQuerySouthCommandTypedDTO<T extends OIBusSouthType, S, IS> {
  southType: T;
  southSettings: S;
  items: Array<HistoryQueryItemCommandTypedDTO<IS>>;
}

export interface HistoryQueryNorthCommandTypedDTO<T extends OIBusNorthType, S> {
  northType: T;
  northSettings: S;
}

export interface HistoryQueryItemCommandTypedDTO<IS> {
  id: string | null;
  name: string;
  enabled: boolean;
  settings: IS;
}

/**
 * Command Data Transfer Object for creating or updating a history query.
 * Used as the request body for history query creation/update endpoints.
 */
export type HistoryQueryCommandDTO = HistoryQueryCommandCommonDTO &
  (
    | HistoryQuerySouthCommandTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'folder-scanner', SouthFolderScannerSettings, SouthFolderScannerItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'modbus', SouthModbusSettings, SouthModbusItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'mqtt', SouthMQTTSettings, SouthMQTTItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'mysql', SouthMySQLSettings, SouthMySQLItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'odbc', SouthODBCSettings, SouthODBCItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'oianalytics', SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'oledb', SouthOLEDBSettings, SouthOLEDBItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'opcua', SouthOPCUASettings, SouthOPCUAItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'oracle', SouthOracleSettings, SouthOracleItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'osisoft-pi', SouthPISettings, SouthPIItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'postgresql', SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'sftp', SouthSFTPSettings, SouthSFTPItemSettings>
    | HistoryQuerySouthCommandTypedDTO<'sqlite', SouthSQLiteSettings, SouthSQLiteItemSettings>
  ) &
  (
    | HistoryQueryNorthCommandTypedDTO<'aws-s3', NorthAmazonS3Settings>
    | HistoryQueryNorthCommandTypedDTO<'azure-blob', NorthAzureBlobSettings>
    | HistoryQueryNorthCommandTypedDTO<'console', NorthConsoleSettings>
    | HistoryQueryNorthCommandTypedDTO<'file-writer', NorthFileWriterSettings>
    | HistoryQueryNorthCommandTypedDTO<'modbus', NorthModbusSettings>
    | HistoryQueryNorthCommandTypedDTO<'mqtt', NorthMQTTSettings>
    | HistoryQueryNorthCommandTypedDTO<'oianalytics', NorthOIAnalyticsSettings>
    | HistoryQueryNorthCommandTypedDTO<'opcua', NorthOPCUASettings>
    | HistoryQueryNorthCommandTypedDTO<'rest', NorthRESTSettings>
    | HistoryQueryNorthCommandTypedDTO<'sftp', NorthSFTPSettings>
  );

/**
 * Data Transfer Object for a history query item.
 * Represents an individual data point to be queried.
 */
export type HistoryQueryItemDTO =
  | HistoryQueryItemTypedDTO<SouthADSItemSettings>
  | HistoryQueryItemTypedDTO<SouthFolderScannerItemSettings>
  | HistoryQueryItemTypedDTO<SouthFTPItemSettings>
  | HistoryQueryItemTypedDTO<SouthModbusItemSettings>
  | HistoryQueryItemTypedDTO<SouthMQTTItemSettings>
  | HistoryQueryItemTypedDTO<SouthMSSQLItemSettings>
  | HistoryQueryItemTypedDTO<SouthMySQLItemSettings>
  | HistoryQueryItemTypedDTO<SouthODBCItemSettings>
  | HistoryQueryItemTypedDTO<SouthOIAnalyticsItemSettings>
  | HistoryQueryItemTypedDTO<SouthOLEDBItemSettings>
  | HistoryQueryItemTypedDTO<SouthOPCItemSettings>
  | HistoryQueryItemTypedDTO<SouthOPCUAItemSettings>
  | HistoryQueryItemTypedDTO<SouthOracleItemSettings>
  | HistoryQueryItemTypedDTO<SouthPIItemSettings>
  | HistoryQueryItemTypedDTO<SouthPostgreSQLItemSettings>
  | HistoryQueryItemTypedDTO<SouthSFTPItemSettings>
  | HistoryQueryItemTypedDTO<SouthSQLiteItemSettings>;

/**
 * Command Data Transfer Object for creating or updating a history query item.
 * Used as the request body for history query item creation/update endpoints.
 */
export type HistoryQueryItemCommandDTO =
  | HistoryQueryItemCommandTypedDTO<SouthADSItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthFolderScannerItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthFTPItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthModbusItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthMQTTItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthMSSQLItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthMySQLItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthODBCItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthOIAnalyticsItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthOLEDBItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthOPCItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthOPCUAItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthOracleItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthPIItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthPostgreSQLItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthSFTPItemSettings>
  | HistoryQueryItemCommandTypedDTO<SouthSQLiteItemSettings>;

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
