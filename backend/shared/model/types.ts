import { OIBusObjectAttribute } from './form.model';

/**
 * Represents an instant in time as an ISO 8601 string.
 * @example "2023-10-31T12:34:56.789Z"
 */
export type Instant = string;

/**
 * Represents a local date as an ISO date string (YYYY-MM-DD).
 * @example "2023-10-31"
 */
export type LocalDate = string;

/**
 * Represents a local time as an ISO time string (HH:MM:SS).
 * @example "12:34:56"
 */
export type LocalTime = string;

/**
 * Represents a timezone as an IANA timezone string.
 * @example "Europe/Paris"
 */
export type Timezone = string;

/**
 * Default timezone used in the application.
 */
export const DEFAULT_TZ: Timezone = 'Europe/Paris';

/**
 * List of supported languages in the application.
 */
export const LANGUAGES = ['fr', 'en'] as const;

/**
 * Type representing a supported language.
 * @example "en"
 */
export type Language = (typeof LANGUAGES)[number];

/**
 * Base entity interface that includes common properties for all entities.
 */
export interface BaseEntity {
  /**
   * The unique identifier of the entity.
   * @example "entity123"
   */
  id: string;

  /**
   * The date and time when the entity was created.
   * @example "2023-10-31T12:34:56.789Z"
   */
  creationDate?: Instant;

  /**
   * The date and time when the entity was last edited.
   * @example "2023-10-31T13:45:00.123Z"
   */
  lastEditInstant?: Instant;
}

/**
 * Represents a paginated response containing an array of elements.
 */
export interface Page<T> {
  /**
   * The content of the page - an array of elements.
   */
  content: Array<T>;

  /**
   * The total number of elements across all pages.
   * @example 2
   */
  totalElements: number;

  /**
   * The size of the page, i.e., the maximum number of elements per page.
   * @example 10
   */
  size: number;

  /**
   * The number of the current page, starting at 0.
   * @example 0
   */
  number: number;

  /**
   * The total number of pages (which can be 0 if there are no elements).
   * @example 1
   */
  totalPages: number;
}

export function createPageFromArray<T>(allElements: Array<T>, pageSize: number, pageNumber: number): Page<T> {
  return {
    content: allElements.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
    number: pageNumber,
    size: pageSize,
    totalElements: allElements.length,
    totalPages: Math.ceil(allElements.length / pageSize)
  };
}

/**
 * Represents a time interval with start and end instants.
 *
 * @example
 * {
 *   "start": "2023-10-31T00:00:00Z",
 *   "end": "2023-10-31T23:59:59Z"
 * }
 */
export interface Interval {
  /**
   * The start of the interval.
   * @example "2023-10-31T00:00:00Z"
   */
  start: Instant;

  /**
   * The end of the interval.
   * @example "2023-10-31T23:59:59Z"
   */
  end: Instant;
}

/**
 * List of supported date/time types.
 */
export const DATE_TIME_TYPES = [
  'iso-string',
  'unix-epoch',
  'unix-epoch-ms',
  'string',
  'date',
  'small-date-time',
  'date-time',
  'date-time-2',
  'date-time-offset',
  'timestamp',
  'timestamptz'
] as const;

/**
 * Type representing a supported date/time type.
 * @example "iso-string"
 */
export type DateTimeType = (typeof DATE_TIME_TYPES)[number];

/**
 * List of supported aggregate functions.
 */
export const AGGREGATES = [
  'raw',
  'interpolative',
  'total',
  'average',
  'time-average',
  'count',
  'stdev',
  'minimum-actual-time',
  'minimum',
  'maximum-actual-time',
  'maximum',
  'start',
  'end',
  'delta',
  'reg-slope',
  'reg-const',
  'reg-dev',
  'variance',
  'range',
  'duration-good',
  'duration-bad',
  'percent-good',
  'percent-bad',
  'worst-quality',
  'annotations'
] as const;

/**
 * Type representing a supported aggregate function.
 * @example "average"
 */
export type Aggregate = (typeof AGGREGATES)[number];

/**
 * List of supported resampling intervals.
 */
export const RESAMPLING = ['none', '1s', '10s', '30s', '1min', '1h', '1d'] as const;

/**
 * Type representing a supported resampling interval.
 * @example "1min"
 */
export type Resampling = (typeof RESAMPLING)[number];

/**
 * List of supported CSV delimiter characters.
 */
export const ALL_CSV_CHARACTERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const;

/**
 * Type representing a supported CSV delimiter character.
 * @example "COMMA"
 */
export type CsvCharacter = (typeof ALL_CSV_CHARACTERS)[number];

/**
 * List of supported serialization types.
 */
export const SERIALIZATION_TYPES = ['csv', 'file'] as const;

/**
 * Type representing a supported serialization type.
 * @example "csv"
 */
export type SerializationType = (typeof SERIALIZATION_TYPES)[number];

/**
 * Base interface for serialization settings.
 */
export interface BaseSerializationSettings {
  /**
   * The type of serialization.
   * @example "csv"
   */
  type: SerializationType;
}

/**
 * Serialization settings for CSV format.
 */
export interface CSVSerializationSettings extends BaseSerializationSettings {
  /**
   * The type of serialization (always 'csv' for this interface).
   */
  type: 'csv';

  /**
   * The format for timestamps in the output.
   * @example "YYYY-MM-DD HH:mm:ss"
   */
  outputTimestampFormat: string;

  /**
   * The timezone for timestamps in the output.
   * @example "Europe/Paris"
   */
  outputTimezone: Timezone;

  /**
   * The name of the output file.
   * @example "output.csv"
   */
  filename: string;

  /**
   * Whether to compress the output file.
   * @example true
   */
  compression: boolean;

  /**
   * The delimiter character to use in the CSV.
   * @example "COMMA"
   */
  delimiter: CsvCharacter;
}

export interface FileSerializationSettings extends BaseSerializationSettings {
  type: 'file';
  filename: string;
  compression: boolean;
}

/**
 * Union type representing all possible serialization settings.
 */
export type SerializationSettings = CSVSerializationSettings | FileSerializationSettings;

/**
 * Manifest for a connector, describing its properties and configuration.
 */
export interface ConnectorManifest {
  /**
   * The unique identifier of the connector.
   * @example "console"
   */
  id: string;

  /**
   * The category of the connector.
   * @example "debug"
   */
  category: string;

  /**
   * The name of the connector.
   * @example "Debug Connector"
   */
  name: string;

  /**
   * A description of the connector.
   * @example "Connector for debugging"
   */
  description: string;

  /**
   * The settings schema for the connector.
   */
  settings: OIBusObjectAttribute;
}
