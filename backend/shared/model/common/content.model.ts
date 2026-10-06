import { Instant } from './types';

/**
 * List of possible OIBus data types.
 */
export const OIBUS_DATA_TYPES = ['any', 'time-values', 'setpoint', 'record-list'] as const;
/**
 * Type representing an OIBus data type.
 * @example 'time-values'
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
 * A time-value pair.
 */
export interface OIBusTimeValue {
  /**
   * The ID of the point.
   * @example "point1"
   */
  pointId: string;

  /**
   * The timestamp of the value.
   * @example "2023-01-01T00:00:00Z"
   */
  timestamp: Instant;

  /**
   * The data associated with the point.
   */
  data: {
    /**
     * The value of the point.
     * @example "100"
     */
    value: string | number;

    /**
     * Additional data associated with the point.
     */
    [key: string]: string | number;
  };
}

/**
 * Time-value content.
 */
export interface OIBusTimeValueContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "time-values"
   */
  type: 'time-values';

  /**
   * The array of time-value pairs.
   */
  content: Array<OIBusTimeValue>;
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
 * Raw content.
 */
export interface OIBusFileContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "any"
   */
  type: 'any';

  /**
   * The path to the file containing the content.
   * @example "/path/to/file.json"
   */
  filePath: string;

  /**
   * The logical filename to store in cache metadata (used as the output filename by north connectors).
   * When omitted, north connectors fall back to path.basename(filePath).
   *
   * South connectors that preserve directory structure (e.g. folder-scanner with recursive=true)
   * set this to the path relative to the source folder, e.g. "subdir/file.json".
   */
  filename?: string;

  /**
   * The content itself, if available.
   */
  content?: string;
}

export interface OIBusAnyContent extends BaseOIBusContent {
  /**
   * The type of content.
   * @example "any-content"
   */
  type: 'any-content';

  /**
   * The content
   */
  content: string;
}

/**
 * A single row of data, as returned by a query-based source (e.g. a SQL database). Keys are
 * column names; values are whatever the source returned, untouched (no datetime parsing/formatting
 * is applied here — that is the responsibility of the north-side transformer, e.g. record-list-to-csv).
 */
export type OIBusRecord = Record<string, string | number | boolean | null>;

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
export type OIBusContent = OIBusTimeValueContent | OIBusFileContent | OIBusAnyContent | OIBusSetpointContent | OIBusRecordListContent;
