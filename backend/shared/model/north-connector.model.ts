/* eslint-disable @typescript-eslint/no-empty-object-type */
import { OIBusDataType } from './engine.model';
import { BaseEntity } from './types';
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
import { TransformerCommandDTOWithOptions, TransformerDTOWithOptions } from './transformer.model';
import { OIBusObjectAttribute } from './form.model';

/**
 * List of available categories for OIBus North connectors.
 */
export const OIBUS_NORTH_CATEGORIES = ['debug', 'api', 'file', 'iot'] as const;

/**
 * Type representing the possible categories for a North connector.
 *
 * @example 'debug'
 */
export type OIBusNorthCategory = (typeof OIBUS_NORTH_CATEGORIES)[number];

/**
 * List of available types for OIBus North connectors.
 */
export const OIBUS_NORTH_TYPES = [
  'azure-blob',
  'aws-s3',
  'console',
  'file-writer',
  'oianalytics',
  'sftp',
  'rest',
  'opcua',
  'mqtt',
  'modbus'
] as const;

/**
 * Type representing the possible types for a North connector.
 *
 * @example 'console'
 */
export type OIBusNorthType = (typeof OIBUS_NORTH_TYPES)[number];

/**
 * Represents the type metadata for a North connector.
 * Describes the basic characteristics of a North connector type.
 */
export interface NorthType {
  /**
   * The unique identifier of the North connector type.
   *
   * @example "console"
   */
  id: OIBusNorthType;
  /**
   * The category of the North connector.
   *
   * @example "debug"
   */
  category: OIBusNorthCategory;
  /**
   * The data types supported by this North connector.
   *
   * @example ["time-values", "any", "setpoints"]
   */
  types: Array<OIBusDataType>;
}

/**
 * Lightweight Data Transfer Object for a North connector.
 * Contains only essential information about a North connector.
 */
export interface NorthConnectorLightDTO extends BaseEntity {
  /**
   * The name of the North connector.
   *
   * @example "Debug Console Output"
   */
  name: string;
  /**
   * The type of the North connector.
   *
   * @example "console"
   */
  type: OIBusNorthType;
  /**
   * The description of the North connector.
   *
   * @example "Outputs data to console for debugging purposes"
   */
  description: string;
  /**
   * Whether the North connector is enabled.
   *
   * @example true
   */
  enabled: boolean;
}

export interface NorthConnectorTypedDTO<T extends OIBusNorthType, S> extends BaseEntity {
  /**
   * The name of the North connector.
   *
   * @example "Debug Console Output"
   */
  name: string;
  /**
   * The type of the North connector.
   *
   * @example "console"
   */
  type: T;
  /**
   * The description of the North connector.
   *
   * @example "Outputs data to console for debugging purposes"
   */
  description: string;
  /**
   * Whether the North connector is enabled.
   *
   * @example true
   */
  enabled: boolean;
  /**
   * The settings specific to the North connector type.
   */
  settings: S;
  /**
   * The caching configuration for the North connector.
   */
  caching: {
    /**
     * The trigger configuration for caching.
     */
    trigger: {
      /**
       * The scan mode configuration.
       */
      scanMode: ScanModeDTO;
      /**
       * The number of elements to trigger a send.
       *
       * @example 1
       */
      numberOfElements: number;
      /**
       * The number of files to trigger a send.
       *
       * @example 1
       */
      numberOfFiles: number;
    };
    /**
     * The throttling configuration for caching.
     */
    throttling: {
      /**
       * The minimum delay (in ms) between runs.
       *
       * @example 100
       */
      runMinDelay: number;
      /**
       * The maximum size (in bytes) of the cache before sending.
       *
       * @example 1048576
       */
      maxSize: number;
      /**
       * The maximum number of elements in the cache before sending.
       *
       * @example 100
       */
      maxNumberOfElements: number;
    };
    /**
     * The error handling configuration for caching.
     */
    error: {
      /**
       * The interval (in ms) between retry attempts.
       *
       * @example 1000
       */
      retryInterval: number;
      /**
       * The maximum number of retry attempts.
       *
       * @example 0
       */
      retryCount: number;
      /**
       * The duration (in ms) to retain error files.
       *
       * @example 86400000
       */
      retentionDuration: number;
    };
    /**
     * The archive configuration for caching.
     */
    archive: {
      /**
       * Whether archiving is enabled.
       *
       * @example false
       */
      enabled: boolean;
      /**
       * The duration (in ms) to retain archived files.
       *
       * @example 0
       */
      retentionDuration: number;
    };
  };
  /**
   * The list of transformers applied to the data.
   */
  transformers: Array<TransformerDTOWithOptions>;
}

// ── Named variants (tsoa uses these as schema names) ─────────────────────
/** North connector configuration for Amazon S3. */
export interface NorthConnectorAmazonS3DTO extends NorthConnectorTypedDTO<'aws-s3', NorthAmazonS3Settings> {}
/** North connector configuration for Azure Blob Storage. */
export interface NorthConnectorAzureBlobDTO extends NorthConnectorTypedDTO<'azure-blob', NorthAzureBlobSettings> {}
/** North connector configuration for the Console debug output. */
export interface NorthConnectorConsoleDTO extends NorthConnectorTypedDTO<'console', NorthConsoleSettings> {}
/** North connector configuration for the File Writer. */
export interface NorthConnectorFileWriterDTO extends NorthConnectorTypedDTO<'file-writer', NorthFileWriterSettings> {}
/** North connector configuration for Modbus. */
export interface NorthConnectorModbusDTO extends NorthConnectorTypedDTO<'modbus', NorthModbusSettings> {}
/** North connector configuration for MQTT. */
export interface NorthConnectorMQTTDTO extends NorthConnectorTypedDTO<'mqtt', NorthMQTTSettings> {}
/** North connector configuration for OIAnalytics. */
export interface NorthConnectorOIAnalyticsDTO extends NorthConnectorTypedDTO<'oianalytics', NorthOIAnalyticsSettings> {}
/** North connector configuration for OPC UA. */
export interface NorthConnectorOPCUADTO extends NorthConnectorTypedDTO<'opcua', NorthOPCUASettings> {}
/** North connector configuration for the REST API. */
export interface NorthConnectorRESTDTO extends NorthConnectorTypedDTO<'rest', NorthRESTSettings> {}
/** North connector configuration for SFTP file transfer. */
export interface NorthConnectorSFTPDTO extends NorthConnectorTypedDTO<'sftp', NorthSFTPSettings> {}

/**
 * Data Transfer Object for a North connector.
 * Contains all configuration details of a North connector.
 */
export type NorthConnectorDTO =
  | NorthConnectorAmazonS3DTO
  | NorthConnectorAzureBlobDTO
  | NorthConnectorConsoleDTO
  | NorthConnectorFileWriterDTO
  | NorthConnectorModbusDTO
  | NorthConnectorMQTTDTO
  | NorthConnectorOIAnalyticsDTO
  | NorthConnectorOPCUADTO
  | NorthConnectorRESTDTO
  | NorthConnectorSFTPDTO;

export interface NorthConnectorCommandTypedDTO<T extends OIBusNorthType, S> {
  /**
   * The name of the North connector.
   *
   * @example "Debug Console Output"
   */
  name: string;
  /**
   * The type of the North connector.
   *
   * @example "console"
   */
  type: T;
  /**
   * The description of the North connector.
   *
   * @example "Outputs data to console for debugging purposes"
   */
  description: string;
  /**
   * Whether the North connector is enabled.
   *
   * @example true
   */
  enabled: boolean;
  /**
   * The settings specific to the North connector type.
   */
  settings: S;
  /**
   * The caching configuration for the North connector.
   */
  caching: {
    /**
     * The trigger configuration for caching.
     */
    trigger: {
      /**
       * The ID of the scan mode.
       *
       * @example "scanModeId1"
       */
      scanModeId: string;
      /**
       * The name of the scan mode. Used to select a scan mode when its ID is unavailable
       *
       * @example null
       */
      scanModeName: string | null;
      /**
       * The number of elements to trigger a send.
       *
       * @example 1
       */
      numberOfElements: number;
      /**
       * The number of files to trigger a send.
       *
       * @example 1
       */
      numberOfFiles: number;
    };
    /**
     * The throttling configuration for caching.
     */
    throttling: {
      /**
       * The minimum delay (in ms) between runs.
       *
       * @example 100
       */
      runMinDelay: number;
      /**
       * The maximum size (in bytes) of the cache before sending.
       *
       * @example 1048576
       */
      maxSize: number;
      /**
       * The maximum number of elements in the cache before sending.
       *
       * @example 100
       */
      maxNumberOfElements: number;
    };
    /**
     * The error handling configuration for caching.
     */
    error: {
      /**
       * The interval (in ms) between retry attempts.
       *
       * @example 1000
       */
      retryInterval: number;
      /**
       * The maximum number of retry attempts.
       *
       * @example 0
       */
      retryCount: number;
      /**
       * The duration (in ms) to retain error files.
       *
       * @example 86400000
       */
      retentionDuration: number;
    };
    /**
     * The archive configuration for caching.
     */
    archive: {
      /**
       * Whether archiving is enabled.
       *
       * @example false
       */
      enabled: boolean;
      /**
       * The duration (in ms) to retain archived files.
       *
       * @example 0
       */
      retentionDuration: number;
    };
  };
  /**
   * The list of transformers to apply to the data.
   *
   * @example []
   */
  transformers: Array<TransformerCommandDTOWithOptions>;
}

// ── Named command variants (tsoa uses these as schema names) ──────────────
/** North connector command for Amazon S3. */
export interface NorthConnectorAmazonS3CommandDTO extends NorthConnectorCommandTypedDTO<'aws-s3', NorthAmazonS3Settings> {}
/** North connector command for Azure Blob Storage. */
export interface NorthConnectorAzureBlobCommandDTO extends NorthConnectorCommandTypedDTO<'azure-blob', NorthAzureBlobSettings> {}
/** North connector command for the Console debug output. */
export interface NorthConnectorConsoleCommandDTO extends NorthConnectorCommandTypedDTO<'console', NorthConsoleSettings> {}
/** North connector command for the File Writer. */
export interface NorthConnectorFileWriterCommandDTO extends NorthConnectorCommandTypedDTO<'file-writer', NorthFileWriterSettings> {}
/** North connector command for Modbus. */
export interface NorthConnectorModbusCommandDTO extends NorthConnectorCommandTypedDTO<'modbus', NorthModbusSettings> {}
/** North connector command for MQTT. */
export interface NorthConnectorMQTTCommandDTO extends NorthConnectorCommandTypedDTO<'mqtt', NorthMQTTSettings> {}
/** North connector command for OIAnalytics. */
export interface NorthConnectorOIAnalyticsCommandDTO extends NorthConnectorCommandTypedDTO<'oianalytics', NorthOIAnalyticsSettings> {}
/** North connector command for OPC UA. */
export interface NorthConnectorOPCUACommandDTO extends NorthConnectorCommandTypedDTO<'opcua', NorthOPCUASettings> {}
/** North connector command for the REST API. */
export interface NorthConnectorRESTCommandDTO extends NorthConnectorCommandTypedDTO<'rest', NorthRESTSettings> {}
/** North connector command for SFTP file transfer. */
export interface NorthConnectorSFTPCommandDTO extends NorthConnectorCommandTypedDTO<'sftp', NorthSFTPSettings> {}

/**
 * Command Data Transfer Object for creating or updating a North connector.
 * Used as the request body for North connector creation/update endpoints.
 */
export type NorthConnectorCommandDTO =
  | NorthConnectorAmazonS3CommandDTO
  | NorthConnectorAzureBlobCommandDTO
  | NorthConnectorConsoleCommandDTO
  | NorthConnectorFileWriterCommandDTO
  | NorthConnectorModbusCommandDTO
  | NorthConnectorMQTTCommandDTO
  | NorthConnectorOIAnalyticsCommandDTO
  | NorthConnectorOPCUACommandDTO
  | NorthConnectorRESTCommandDTO
  | NorthConnectorSFTPCommandDTO;

/**
 * Manifest for a North connector type.
 * Describes the configuration schema and capabilities of a North connector type.
 */
export interface NorthConnectorManifest {
  /**
   * The unique identifier of the North connector type.
   *
   * @example "console"
   */
  id: OIBusNorthType;
  /**
   * The category of the North connector.
   *
   * @example "debug"
   */
  category: OIBusNorthCategory;
  /**
   * The data types supported by this North connector.
   *
   * @example ["time-values", "any", "setpoints"]
   */
  types: Array<string>;
  /**
   * The configuration schema for the North connector settings.
   */
  settings: OIBusObjectAttribute;
}
