import { OIBusDataType } from '../common/content.model';
import { OIBusObjectAttribute } from './form.model';

/**
 * List of available categories for OIBus North connectors.
 */
export const OIBUS_NORTH_CATEGORIES = ['debug', 'api', 'file', 'iot', 'database'] as const;

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
  'azure-data-explorer',
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
   * Whether this connector type is in beta.
   *
   * @example false
   */
  beta?: boolean;
  /**
   * The data types supported by this North connector.
   *
   * @example ["time-values", "any", "setpoints"]
   */
  types: Array<OIBusDataType>;
}

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
   * Whether this connector type is in beta.
   *
   * @example false
   */
  beta?: boolean;
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
