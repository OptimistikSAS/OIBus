/* eslint-disable @typescript-eslint/no-empty-object-type */
import { BaseEntity, Instant } from './types';
import { OIBusNorthType } from './north-connector.model';
import { OIBusSouthType } from './south-connector.model';
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
import { HistoryTransformerCommandDTOWithOptions, HistoryTransformerDTOWithOptions } from './transformer.model';

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

  queryTimeRange: {
    /**
     * Start time for the data to be queried (ISO 8601 format).
     *
     * @example "2023-01-01T00:00:00Z"
     */
    startTime: Instant;

    /**
     * End time for the data to be queried (ISO 8601 format).
     *
     * @example "2023-01-31T23:59:59Z"
     */
    endTime: Instant;

    /**
     * Maximum interval (in seconds) between data reads.
     *
     * @example 3600
     */
    maxReadInterval: number;

    /**
     * Delay (in milliseconds) before the next data read.
     *
     * @example 200
     */
    readDelay: number;
  };

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
  northTransformers: Array<HistoryTransformerDTOWithOptions>;
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

// ── Named south DTO variants (tsoa uses these as schema names) ────────────
/** History query south DTO for Beckhoff ADS. */
export interface HistoryQueryADSSouthDTO extends HistoryQuerySouthTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings> {
  items: Array<HistoryQueryADSItemDTO>;
}
/** History query south DTO for the Folder Scanner. */
export interface HistoryQueryFolderScannerSouthDTO extends HistoryQuerySouthTypedDTO<
  'folder-scanner',
  SouthFolderScannerSettings,
  SouthFolderScannerItemSettings
> {
  items: Array<HistoryQueryFolderScannerItemDTO>;
}
/** History query south DTO for FTP file transfer. */
export interface HistoryQueryFTPSouthDTO extends HistoryQuerySouthTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings> {
  items: Array<HistoryQueryFTPItemDTO>;
}
/** History query south DTO for InfluxDB time series database. */
export interface HistoryQueryInfluxDBSouthDTO extends HistoryQuerySouthTypedDTO<
  'influxdb',
  SouthInfluxDBSettings,
  SouthInfluxDBItemSettings
> {
  items: Array<HistoryQueryInfluxDBItemDTO>;
}
/** History query south DTO for Modbus. */
export interface HistoryQueryModbusSouthDTO extends HistoryQuerySouthTypedDTO<'modbus', SouthModbusSettings, SouthModbusItemSettings> {
  items: Array<HistoryQueryModbusItemDTO>;
}
/** History query south DTO for MQTT. */
export interface HistoryQueryMQTTSouthDTO extends HistoryQuerySouthTypedDTO<'mqtt', SouthMQTTSettings, SouthMQTTItemSettings> {
  items: Array<HistoryQueryMQTTItemDTO>;
}
/** History query south DTO for Microsoft SQL Server. */
export interface HistoryQueryMSSQLSouthDTO extends HistoryQuerySouthTypedDTO<'mssql', SouthMSSQLSettings, SouthMSSQLItemSettings> {
  items: Array<HistoryQueryMSSQLItemDTO>;
}
/** History query south DTO for MySQL. */
export interface HistoryQueryMySQLSouthDTO extends HistoryQuerySouthTypedDTO<'mysql', SouthMySQLSettings, SouthMySQLItemSettings> {
  items: Array<HistoryQueryMySQLItemDTO>;
}
/** History query south DTO for ODBC. */
export interface HistoryQueryODBCSouthDTO extends HistoryQuerySouthTypedDTO<'odbc', SouthODBCSettings, SouthODBCItemSettings> {
  items: Array<HistoryQueryODBCItemDTO>;
}
/** History query south DTO for OIAnalytics. */
export interface HistoryQueryOIAnalyticsSouthDTO extends HistoryQuerySouthTypedDTO<
  'oianalytics',
  SouthOIAnalyticsSettings,
  SouthOIAnalyticsItemSettings
> {
  items: Array<HistoryQueryOIAnalyticsItemDTO>;
}
/** History query south DTO for OLE DB. */
export interface HistoryQueryOLEDBSouthDTO extends HistoryQuerySouthTypedDTO<'oledb', SouthOLEDBSettings, SouthOLEDBItemSettings> {
  items: Array<HistoryQueryOLEDBItemDTO>;
}
/** History query south DTO for classic OPC (OLE for Process Control). */
export interface HistoryQueryOPCSouthDTO extends HistoryQuerySouthTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings> {
  items: Array<HistoryQueryOPCItemDTO>;
}
/** History query south DTO for OPC UA. */
export interface HistoryQueryOPCUASouthDTO extends HistoryQuerySouthTypedDTO<'opcua', SouthOPCUASettings, SouthOPCUAItemSettings> {
  items: Array<HistoryQueryOPCUAItemDTO>;
}
/** History query south DTO for Oracle Database. */
export interface HistoryQueryOracleSouthDTO extends HistoryQuerySouthTypedDTO<'oracle', SouthOracleSettings, SouthOracleItemSettings> {
  items: Array<HistoryQueryOracleItemDTO>;
}
/** History query south DTO for OSIsoft PI System. */
export interface HistoryQueryOsisoftPISouthDTO extends HistoryQuerySouthTypedDTO<'osisoft-pi', SouthPISettings, SouthPIItemSettings> {
  items: Array<HistoryQueryOsisoftPIItemDTO>;
}
/** History query south DTO for PostgreSQL. */
export interface HistoryQueryPostgreSQLSouthDTO extends HistoryQuerySouthTypedDTO<
  'postgresql',
  SouthPostgreSQLSettings,
  SouthPostgreSQLItemSettings
> {
  items: Array<HistoryQueryPostgreSQLItemDTO>;
}
/** History query south DTO for the REST API. */
export interface HistoryQueryRESTSouthDTO extends HistoryQuerySouthTypedDTO<'rest', SouthRestSettings, SouthRestItemSettings> {
  items: Array<HistoryQueryRESTItemDTO>;
}
/** History query south DTO for SFTP file transfer. */
export interface HistoryQuerySFTPSouthDTO extends HistoryQuerySouthTypedDTO<'sftp', SouthSFTPSettings, SouthSFTPItemSettings> {
  items: Array<HistoryQuerySFTPItemDTO>;
}
/** History query south DTO for SQLite. */
export interface HistoryQuerySQLiteSouthDTO extends HistoryQuerySouthTypedDTO<'sqlite', SouthSQLiteSettings, SouthSQLiteItemSettings> {
  items: Array<HistoryQuerySQLiteItemDTO>;
}

// ── Named north DTO variants (tsoa uses these as schema names) ────────────
/** History query north DTO for Amazon S3. */
export interface HistoryQueryAmazonS3NorthDTO extends HistoryQueryNorthTypedDTO<'aws-s3', NorthAmazonS3Settings> {}
/** History query north DTO for Azure Blob Storage. */
export interface HistoryQueryAzureBlobNorthDTO extends HistoryQueryNorthTypedDTO<'azure-blob', NorthAzureBlobSettings> {}
/** History query north DTO for the Console debug output. */
export interface HistoryQueryConsoleNorthDTO extends HistoryQueryNorthTypedDTO<'console', NorthConsoleSettings> {}
/** History query north DTO for the File Writer. */
export interface HistoryQueryFileWriterNorthDTO extends HistoryQueryNorthTypedDTO<'file-writer', NorthFileWriterSettings> {}
/** History query north DTO for Modbus. */
export interface HistoryQueryModbusNorthDTO extends HistoryQueryNorthTypedDTO<'modbus', NorthModbusSettings> {}
/** History query north DTO for MQTT. */
export interface HistoryQueryMQTTNorthDTO extends HistoryQueryNorthTypedDTO<'mqtt', NorthMQTTSettings> {}
/** History query north DTO for OIAnalytics. */
export interface HistoryQueryOIAnalyticsNorthDTO extends HistoryQueryNorthTypedDTO<'oianalytics', NorthOIAnalyticsSettings> {}
/** History query north DTO for OPC UA. */
export interface HistoryQueryOPCUANorthDTO extends HistoryQueryNorthTypedDTO<'opcua', NorthOPCUASettings> {}
/** History query north DTO for the REST API. */
export interface HistoryQueryRESTNorthDTO extends HistoryQueryNorthTypedDTO<'rest', NorthRESTSettings> {}
/** History query north DTO for SFTP file transfer. */
export interface HistoryQuerySFTPNorthDTO extends HistoryQueryNorthTypedDTO<'sftp', NorthSFTPSettings> {}

export type HistoryQueryDTO = BaseEntity &
  HistoryQueryCommonDTO &
  (
    | HistoryQueryADSSouthDTO
    | HistoryQueryFolderScannerSouthDTO
    | HistoryQueryFTPSouthDTO
    | HistoryQueryInfluxDBSouthDTO
    | HistoryQueryModbusSouthDTO
    | HistoryQueryMQTTSouthDTO
    | HistoryQueryMSSQLSouthDTO
    | HistoryQueryMySQLSouthDTO
    | HistoryQueryODBCSouthDTO
    | HistoryQueryOIAnalyticsSouthDTO
    | HistoryQueryOLEDBSouthDTO
    | HistoryQueryOPCSouthDTO
    | HistoryQueryOPCUASouthDTO
    | HistoryQueryOracleSouthDTO
    | HistoryQueryOsisoftPISouthDTO
    | HistoryQueryPostgreSQLSouthDTO
    | HistoryQueryRESTSouthDTO
    | HistoryQuerySFTPSouthDTO
    | HistoryQuerySQLiteSouthDTO
  ) &
  (
    | HistoryQueryAmazonS3NorthDTO
    | HistoryQueryAzureBlobNorthDTO
    | HistoryQueryConsoleNorthDTO
    | HistoryQueryFileWriterNorthDTO
    | HistoryQueryModbusNorthDTO
    | HistoryQueryMQTTNorthDTO
    | HistoryQueryOIAnalyticsNorthDTO
    | HistoryQueryOPCUANorthDTO
    | HistoryQueryRESTNorthDTO
    | HistoryQuerySFTPNorthDTO
  );

export interface HistoryQueryCommandCommonDTO {
  name: string;
  description: string;
  queryTimeRange: {
    startTime: Instant;
    endTime: Instant;
    maxReadInterval: number;
    readDelay: number;
  };
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
  northTransformers: Array<HistoryTransformerCommandDTOWithOptions>;
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

// ── Named south command variants (tsoa uses these as schema names) ─────────
/** History query south command for Beckhoff ADS. */
export interface HistoryQueryADSSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<'ads', SouthADSSettings, SouthADSItemSettings> {
  items: Array<HistoryQueryADSItemCommandDTO>;
}
/** History query south command for the Folder Scanner. */
export interface HistoryQueryFolderScannerSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'folder-scanner',
  SouthFolderScannerSettings,
  SouthFolderScannerItemSettings
> {
  items: Array<HistoryQueryFolderScannerItemCommandDTO>;
}
/** History query south command for FTP file transfer. */
export interface HistoryQueryFTPSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<'ftp', SouthFTPSettings, SouthFTPItemSettings> {
  items: Array<HistoryQueryFTPItemCommandDTO>;
}
/** History query south command for InfluxDB time series database. */
export interface HistoryQueryInfluxDBSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'influxdb',
  SouthInfluxDBSettings,
  SouthInfluxDBItemSettings
> {
  items: Array<HistoryQueryInfluxDBItemCommandDTO>;
}
/** History query south command for Modbus. */
export interface HistoryQueryModbusSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'modbus',
  SouthModbusSettings,
  SouthModbusItemSettings
> {
  items: Array<HistoryQueryModbusItemCommandDTO>;
}
/** History query south command for MQTT. */
export interface HistoryQueryMQTTSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'mqtt',
  SouthMQTTSettings,
  SouthMQTTItemSettings
> {
  items: Array<HistoryQueryMQTTItemCommandDTO>;
}
/** History query south command for Microsoft SQL Server. */
export interface HistoryQueryMSSQLSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'mssql',
  SouthMSSQLSettings,
  SouthMSSQLItemSettings
> {
  items: Array<HistoryQueryMSSQLItemCommandDTO>;
}
/** History query south command for MySQL. */
export interface HistoryQueryMySQLSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'mysql',
  SouthMySQLSettings,
  SouthMySQLItemSettings
> {
  items: Array<HistoryQueryMySQLItemCommandDTO>;
}
/** History query south command for ODBC. */
export interface HistoryQueryODBCSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'odbc',
  SouthODBCSettings,
  SouthODBCItemSettings
> {
  items: Array<HistoryQueryODBCItemCommandDTO>;
}
/** History query south command for OIAnalytics. */
export interface HistoryQueryOIAnalyticsSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'oianalytics',
  SouthOIAnalyticsSettings,
  SouthOIAnalyticsItemSettings
> {
  items: Array<HistoryQueryOIAnalyticsItemCommandDTO>;
}
/** History query south command for OLE DB. */
export interface HistoryQueryOLEDBSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'oledb',
  SouthOLEDBSettings,
  SouthOLEDBItemSettings
> {
  items: Array<HistoryQueryOLEDBItemCommandDTO>;
}
/** History query south command for classic OPC (OLE for Process Control). */
export interface HistoryQueryOPCSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<'opc', SouthOPCSettings, SouthOPCItemSettings> {
  items: Array<HistoryQueryOPCItemCommandDTO>;
}
/** History query south command for OPC UA. */
export interface HistoryQueryOPCUASouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'opcua',
  SouthOPCUASettings,
  SouthOPCUAItemSettings
> {
  items: Array<HistoryQueryOPCUAItemCommandDTO>;
}
/** History query south command for Oracle Database. */
export interface HistoryQueryOracleSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'oracle',
  SouthOracleSettings,
  SouthOracleItemSettings
> {
  items: Array<HistoryQueryOracleItemCommandDTO>;
}
/** History query south command for OSIsoft PI System. */
export interface HistoryQueryOsisoftPISouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'osisoft-pi',
  SouthPISettings,
  SouthPIItemSettings
> {
  items: Array<HistoryQueryOsisoftPIItemCommandDTO>;
}
/** History query south command for PostgreSQL. */
export interface HistoryQueryPostgreSQLSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'postgresql',
  SouthPostgreSQLSettings,
  SouthPostgreSQLItemSettings
> {
  items: Array<HistoryQueryPostgreSQLItemCommandDTO>;
}
/** History query south command for the REST API. */
export interface HistoryQueryRESTSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'rest',
  SouthRestSettings,
  SouthRestItemSettings
> {
  items: Array<HistoryQueryRESTItemCommandDTO>;
}
/** History query south command for SFTP file transfer. */
export interface HistoryQuerySFTPSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'sftp',
  SouthSFTPSettings,
  SouthSFTPItemSettings
> {
  items: Array<HistoryQuerySFTPItemCommandDTO>;
}
/** History query south command for SQLite. */
export interface HistoryQuerySQLiteSouthCommandDTO extends HistoryQuerySouthCommandTypedDTO<
  'sqlite',
  SouthSQLiteSettings,
  SouthSQLiteItemSettings
> {
  items: Array<HistoryQuerySQLiteItemCommandDTO>;
}

// ── Named north command variants (tsoa uses these as schema names) ─────────
/** History query north command for Amazon S3. */
export interface HistoryQueryAmazonS3NorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'aws-s3', NorthAmazonS3Settings> {}
/** History query north command for Azure Blob Storage. */
export interface HistoryQueryAzureBlobNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'azure-blob', NorthAzureBlobSettings> {}
/** History query north command for the Console debug output. */
export interface HistoryQueryConsoleNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'console', NorthConsoleSettings> {}
/** History query north command for the File Writer. */
export interface HistoryQueryFileWriterNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'file-writer', NorthFileWriterSettings> {}
/** History query north command for Modbus. */
export interface HistoryQueryModbusNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'modbus', NorthModbusSettings> {}
/** History query north command for MQTT. */
export interface HistoryQueryMQTTNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'mqtt', NorthMQTTSettings> {}
/** History query north command for OIAnalytics. */
export interface HistoryQueryOIAnalyticsNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'oianalytics', NorthOIAnalyticsSettings> {}
/** History query north command for OPC UA. */
export interface HistoryQueryOPCUANorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'opcua', NorthOPCUASettings> {}
/** History query north command for the REST API. */
export interface HistoryQueryRESTNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'rest', NorthRESTSettings> {}
/** History query north command for SFTP file transfer. */
export interface HistoryQuerySFTPNorthCommandDTO extends HistoryQueryNorthCommandTypedDTO<'sftp', NorthSFTPSettings> {}

/**
 * Command Data Transfer Object for creating or updating a history query.
 * Used as the request body for history query creation/update endpoints.
 */
export type HistoryQueryCommandDTO = HistoryQueryCommandCommonDTO &
  (
    | HistoryQueryADSSouthCommandDTO
    | HistoryQueryFolderScannerSouthCommandDTO
    | HistoryQueryFTPSouthCommandDTO
    | HistoryQueryInfluxDBSouthCommandDTO
    | HistoryQueryModbusSouthCommandDTO
    | HistoryQueryMQTTSouthCommandDTO
    | HistoryQueryMSSQLSouthCommandDTO
    | HistoryQueryMySQLSouthCommandDTO
    | HistoryQueryODBCSouthCommandDTO
    | HistoryQueryOIAnalyticsSouthCommandDTO
    | HistoryQueryOLEDBSouthCommandDTO
    | HistoryQueryOPCSouthCommandDTO
    | HistoryQueryOPCUASouthCommandDTO
    | HistoryQueryOracleSouthCommandDTO
    | HistoryQueryOsisoftPISouthCommandDTO
    | HistoryQueryPostgreSQLSouthCommandDTO
    | HistoryQueryRESTSouthCommandDTO
    | HistoryQuerySFTPSouthCommandDTO
    | HistoryQuerySQLiteSouthCommandDTO
  ) &
  (
    | HistoryQueryAmazonS3NorthCommandDTO
    | HistoryQueryAzureBlobNorthCommandDTO
    | HistoryQueryConsoleNorthCommandDTO
    | HistoryQueryFileWriterNorthCommandDTO
    | HistoryQueryModbusNorthCommandDTO
    | HistoryQueryMQTTNorthCommandDTO
    | HistoryQueryOIAnalyticsNorthCommandDTO
    | HistoryQueryOPCUANorthCommandDTO
    | HistoryQueryRESTNorthCommandDTO
    | HistoryQuerySFTPNorthCommandDTO
  );

// ── Named item DTO variants (tsoa uses these as schema names) ────────────
/** History query item DTO for Beckhoff ADS. */
export interface HistoryQueryADSItemDTO extends HistoryQueryItemTypedDTO<SouthADSItemSettings> {}
/** History query item DTO for the Folder Scanner. */
export interface HistoryQueryFolderScannerItemDTO extends HistoryQueryItemTypedDTO<SouthFolderScannerItemSettings> {}
/** History query item DTO for FTP file transfer. */
export interface HistoryQueryFTPItemDTO extends HistoryQueryItemTypedDTO<SouthFTPItemSettings> {}
/** History query item DTO for InfluxDB time series database. */
export interface HistoryQueryInfluxDBItemDTO extends HistoryQueryItemTypedDTO<SouthInfluxDBItemSettings> {}
/** History query item DTO for Modbus. */
export interface HistoryQueryModbusItemDTO extends HistoryQueryItemTypedDTO<SouthModbusItemSettings> {}
/** History query item DTO for MQTT. */
export interface HistoryQueryMQTTItemDTO extends HistoryQueryItemTypedDTO<SouthMQTTItemSettings> {}
/** History query item DTO for Microsoft SQL Server. */
export interface HistoryQueryMSSQLItemDTO extends HistoryQueryItemTypedDTO<SouthMSSQLItemSettings> {}
/** History query item DTO for MySQL. */
export interface HistoryQueryMySQLItemDTO extends HistoryQueryItemTypedDTO<SouthMySQLItemSettings> {}
/** History query item DTO for ODBC. */
export interface HistoryQueryODBCItemDTO extends HistoryQueryItemTypedDTO<SouthODBCItemSettings> {}
/** History query item DTO for OIAnalytics. */
export interface HistoryQueryOIAnalyticsItemDTO extends HistoryQueryItemTypedDTO<SouthOIAnalyticsItemSettings> {}
/** History query item DTO for OLE DB. */
export interface HistoryQueryOLEDBItemDTO extends HistoryQueryItemTypedDTO<SouthOLEDBItemSettings> {}
/** History query item DTO for classic OPC (OLE for Process Control). */
export interface HistoryQueryOPCItemDTO extends HistoryQueryItemTypedDTO<SouthOPCItemSettings> {}
/** History query item DTO for OPC UA. */
export interface HistoryQueryOPCUAItemDTO extends HistoryQueryItemTypedDTO<SouthOPCUAItemSettings> {}
/** History query item DTO for Oracle Database. */
export interface HistoryQueryOracleItemDTO extends HistoryQueryItemTypedDTO<SouthOracleItemSettings> {}
/** History query item DTO for OSIsoft PI System. */
export interface HistoryQueryOsisoftPIItemDTO extends HistoryQueryItemTypedDTO<SouthPIItemSettings> {}
/** History query item DTO for PostgreSQL. */
export interface HistoryQueryPostgreSQLItemDTO extends HistoryQueryItemTypedDTO<SouthPostgreSQLItemSettings> {}
/** History query item DTO for the REST API. */
export interface HistoryQueryRESTItemDTO extends HistoryQueryItemTypedDTO<SouthRestItemSettings> {}
/** History query item DTO for SFTP file transfer. */
export interface HistoryQuerySFTPItemDTO extends HistoryQueryItemTypedDTO<SouthSFTPItemSettings> {}
/** History query item DTO for SQLite. */
export interface HistoryQuerySQLiteItemDTO extends HistoryQueryItemTypedDTO<SouthSQLiteItemSettings> {}

/**
 * Data Transfer Object for a history query item.
 * Represents an individual data point to be queried.
 */
export type HistoryQueryItemDTO =
  | HistoryQueryADSItemDTO
  | HistoryQueryFolderScannerItemDTO
  | HistoryQueryFTPItemDTO
  | HistoryQueryInfluxDBItemDTO
  | HistoryQueryModbusItemDTO
  | HistoryQueryMQTTItemDTO
  | HistoryQueryMSSQLItemDTO
  | HistoryQueryMySQLItemDTO
  | HistoryQueryODBCItemDTO
  | HistoryQueryOIAnalyticsItemDTO
  | HistoryQueryOLEDBItemDTO
  | HistoryQueryOPCItemDTO
  | HistoryQueryOPCUAItemDTO
  | HistoryQueryOracleItemDTO
  | HistoryQueryOsisoftPIItemDTO
  | HistoryQueryPostgreSQLItemDTO
  | HistoryQueryRESTItemDTO
  | HistoryQuerySFTPItemDTO
  | HistoryQuerySQLiteItemDTO;

// ── Named item command variants (tsoa uses these as schema names) ─────────
/** History query item command for Beckhoff ADS. */
export interface HistoryQueryADSItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthADSItemSettings> {}
/** History query item command for the Folder Scanner. */
export interface HistoryQueryFolderScannerItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthFolderScannerItemSettings> {}
/** History query item command for FTP file transfer. */
export interface HistoryQueryFTPItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthFTPItemSettings> {}
/** History query item command for InfluxDB time series database. */
export interface HistoryQueryInfluxDBItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthInfluxDBItemSettings> {}
/** History query item command for Modbus. */
export interface HistoryQueryModbusItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthModbusItemSettings> {}
/** History query item command for MQTT. */
export interface HistoryQueryMQTTItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthMQTTItemSettings> {}
/** History query item command for Microsoft SQL Server. */
export interface HistoryQueryMSSQLItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthMSSQLItemSettings> {}
/** History query item command for MySQL. */
export interface HistoryQueryMySQLItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthMySQLItemSettings> {}
/** History query item command for ODBC. */
export interface HistoryQueryODBCItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthODBCItemSettings> {}
/** History query item command for OIAnalytics. */
export interface HistoryQueryOIAnalyticsItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthOIAnalyticsItemSettings> {}
/** History query item command for OLE DB. */
export interface HistoryQueryOLEDBItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthOLEDBItemSettings> {}
/** History query item command for classic OPC (OLE for Process Control). */
export interface HistoryQueryOPCItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthOPCItemSettings> {}
/** History query item command for OPC UA. */
export interface HistoryQueryOPCUAItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthOPCUAItemSettings> {}
/** History query item command for Oracle Database. */
export interface HistoryQueryOracleItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthOracleItemSettings> {}
/** History query item command for OSIsoft PI System. */
export interface HistoryQueryOsisoftPIItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthPIItemSettings> {}
/** History query item command for PostgreSQL. */
export interface HistoryQueryPostgreSQLItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthPostgreSQLItemSettings> {}
/** History query item command for the REST API. */
export interface HistoryQueryRESTItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthRestItemSettings> {}
/** History query item command for SFTP file transfer. */
export interface HistoryQuerySFTPItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthSFTPItemSettings> {}
/** History query item command for SQLite. */
export interface HistoryQuerySQLiteItemCommandDTO extends HistoryQueryItemCommandTypedDTO<SouthSQLiteItemSettings> {}

/**
 * Command Data Transfer Object for creating or updating a history query item.
 * Used as the request body for history query item creation/update endpoints.
 */
export type HistoryQueryItemCommandDTO =
  | HistoryQueryADSItemCommandDTO
  | HistoryQueryFolderScannerItemCommandDTO
  | HistoryQueryFTPItemCommandDTO
  | HistoryQueryInfluxDBItemCommandDTO
  | HistoryQueryModbusItemCommandDTO
  | HistoryQueryMQTTItemCommandDTO
  | HistoryQueryMSSQLItemCommandDTO
  | HistoryQueryMySQLItemCommandDTO
  | HistoryQueryODBCItemCommandDTO
  | HistoryQueryOIAnalyticsItemCommandDTO
  | HistoryQueryOLEDBItemCommandDTO
  | HistoryQueryOPCItemCommandDTO
  | HistoryQueryOPCUAItemCommandDTO
  | HistoryQueryOracleItemCommandDTO
  | HistoryQueryOsisoftPIItemCommandDTO
  | HistoryQueryPostgreSQLItemCommandDTO
  | HistoryQueryRESTItemCommandDTO
  | HistoryQuerySFTPItemCommandDTO
  | HistoryQuerySQLiteItemCommandDTO;

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
  name?: string | undefined;

  /**
   * Filter by enabled status.
   * Undefined means no filtering by enabled status.
   *
   * @example true
   */
  enabled?: boolean | undefined;

  /**
   * Page number for pagination (0-based index).
   *
   * @example 0
   */
  page: number;
}
