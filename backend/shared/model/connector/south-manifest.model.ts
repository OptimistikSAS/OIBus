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
  'bacnet', // BACnet/IP building automation protocol
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
 * South connector types belonging to the "IoT family" (OPC UA, Modbus, ADS, OPC classic, S7, MQTT), for
 * which per-item caching strategy is available.
 */
export const IOT_FAMILY_SOUTH_TYPES: Array<OIBusSouthType> = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt', 'bacnet'];

/**
 * Shape of a Configuration Workflow's `discoveryScope` for a connector type that supports discovery:
 * - `tree`: the nodes checked in the Explore modal (`{ nodeIds: Array<string> }`), each point for itself and any other
 *   node for everything under it - or a root node to walk the data source from (`{ rootNodeId?: string }`) - e.g. OPC-UA
 * - `query`: a dedicated SQL metadata query (`{ query: string }`) - the SQL-family connectors. Their tables and columns
 *   checked in the Explore modal (`{ nodeIds }`) are discovered too, one record per table, to add as items
 */
export type SouthDiscoveryKind = 'tree' | 'query';

/**
 * How the records a connector discovers from the nodes checked in the Explore modal become items, when they always
 * have the same shape: how a record identifies itself across runs, and how it becomes an item. "Add as items" maps
 * them with it, and a new Configuration Workflow starts from it.
 */
export interface SouthDiscoveryDefaults {
  /**
   * Discovered-record field(s) identifying a record across runs.
   * @example ["id"]
   */
  identityKeyFields: Array<string>;

  /**
   * Item field path to a constant or a {{field}} expression of the discovered record, as a workflow's own
   * `itemFieldMapping`. A field left out gets its manifest default where it applies, as in the item form: every
   * required one without a default must be mapped.
   * @example { "name": "{{path}}", "settings.nodeId": "{{nodeId}}", "settings.mode": "da" }
   */
  itemFieldMapping: Record<string, string>;
}

/**
 * How a connector type feeds Configuration Workflows.
 */
export interface SouthConnectorDiscovery {
  /** The shape of a workflow's discovery scope */
  kind: SouthDiscoveryKind;

  /** How the records of checked nodes become items; absent when the connector can't tell (see SouthDiscoveryDefaults) */
  defaults?: SouthDiscoveryDefaults;
}

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
   * Whether this connector type can feed Configuration Workflows, the shape of their discovery scope and the
   * starting values of a new one. Absent when the connector has no discovery.
   * UI capability flag — mirrors the connector's structural `hasConfigurationDiscovery()`. ODBC and OLEDB
   * are SQL-family too but route through a separate agent process, so they don't have discovery yet.
   */
  discovery?: SouthConnectorDiscovery;

  /**
   * The configuration schema for the connector settings.
   */
  settings: OIBusObjectAttribute;

  /**
   * The configuration schema for items (data points).
   */
  items: OIBusArrayAttribute;
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
