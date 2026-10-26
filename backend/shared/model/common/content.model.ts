import { Instant } from './types';

/**
 * List of possible OIBus data types.
 */
export const OIBUS_DATA_TYPES = ['file', 'setpoint', 'record-list'] as const;
/**
 * Type representing an OIBus data type.
 * @example 'record-list'
 */
export type OIBusDataType = (typeof OIBUS_DATA_TYPES)[number];

/**
 * Base interface for OIBus content.
 */
interface BaseOIBusContent {
  /**
   * The type of content.
   */
  type: string;
}

/**
 * A setpoint.
 */
export interface OIBusSetpoint {
  /**
   * The reference of the setpoint.
   * @example "setpoint1"
   */
  reference: string;

  /**
   * The value of the setpoint.
   * @example 100
   */
  value: string | number | boolean;
}

/**
 * Setpoint content.
 */
export interface OIBusSetpointContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "setpoint"
   */
  type: 'setpoint';

  /**
   * The array of setpoints.
   */
  content: Array<OIBusSetpoint>;
}

/**
 * A file: written on disk (its path), or held in memory (its content, e.g. the JSON messages of the MQTT South or the
 * JSON pushed to the OIBus API).
 */
export interface OIBusFileContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "file"
   */
  type: 'file';

  /**
   * The path of the file on disk, when its content is not held in memory.
   * @example "/path/to/file.json"
   */
  filePath?: string;

  /**
   * The logical filename to store in cache metadata (used as the output filename by north connectors).
   * When omitted, north connectors fall back to path.basename(filePath).
   *
   * South connectors that preserve directory structure (e.g. folder-scanner with recursive=true)
   * set this to the path relative to the source folder, e.g. "subdir/file.json".
   */
  filename?: string;

  /**
   * The content itself, when held in memory: it is then used instead of the file on disk.
   */
  content?: string;
}

/**
 * A single row of data, as returned by a query-based source (e.g. a SQL database). Keys are
 * column names; values are whatever the source returned, untouched (no datetime parsing/formatting
 * is applied here — that is the responsibility of the north-side transformer, e.g. record-list-to-csv).
 */
export type OIBusRecord = Record<string, string | number | boolean | null>;

/**
 * A record of a point-based source (OPC UA, Modbus, S7...): the point, the timestamp and the value, possibly with
 * extra fields depending on the protocol (e.g. the OPC UA quality). The record-list transformers and North connectors
 * that need a point, a timestamp and a value read these fields by default.
 */
export interface OIBusPointRecord {
  /**
   * The ID of the point.
   * @example "point1"
   */
  pointId: string;

  /**
   * The timestamp of the value.
   * @example "2023-01-01T00:00:00.000Z"
   */
  timestamp: Instant;

  /**
   * The value of the point.
   * @example 100
   */
  value: string | number;

  /**
   * Additional fields, depending on the protocol.
   */
  [field: string]: string | number | boolean | null;
}

/**
 * Record-list content: a list of flat, arbitrarily-shaped rows (e.g. the result of a SQL query).
 */
export interface OIBusRecordListContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "record-list"
   */
  type: 'record-list';

  /**
   * The array of rows.
   */
  content: Array<OIBusRecord>;
}

/**
 * Type representing OIBus content.
 */
export type OIBusContent = OIBusFileContent | OIBusSetpointContent | OIBusRecordListContent;
