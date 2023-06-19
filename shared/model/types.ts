export type Instant = string;
export type LocalDate = string;
export type LocalTime = string;
export type LocalDateTime = string;
export type Timezone = string;

export const DEFAULT_TZ: Timezone = 'Europe/Paris';

export const LANGUAGES = ['fr', 'en'];
export type Language = typeof LANGUAGES[number];

export interface Page<T> {
  /**
   * The content of the page
   */
  content: Array<T>;
  /**
   * The total number of elements
   */
  totalElements: number;

  /**
   * The size of the page, i.e. the max size of the array of elements
   */
  size: number;

  /**
   * The number of the page, starting at 0
   */
  number: number;

  /**
   * The total number of pages (which can be 0)
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

export interface Interval {
  start: Instant;
  end: Instant;
}

export const DATE_TIME_TYPES = ['specific-string', 'iso-8601-string', 'date-object', 'unix-epoch', 'unix-epoch-ms'];
export type DateTimeType = typeof DATE_TIME_TYPES[number];

interface BaseDateTimeFormat {
  type: DateTimeType;
}

export interface StringDateTimeFormat extends BaseDateTimeFormat {
  type: 'specific-string';
  format: string;
  locale: string;
  timezone: string;
}

export interface Iso8601StringDateTimeFormat extends BaseDateTimeFormat {
  type: 'iso-8601-string';
}

export interface DateObjectDateTimeFormat extends BaseDateTimeFormat {
  type: 'date-object';
  timezone: string;
  dateObjectType: string | null;
}

export interface UnixEpochDateTimeFormat extends BaseDateTimeFormat {
  type: 'unix-epoch';
}

export interface UnixEpochMsDateTimeFormat extends BaseDateTimeFormat {
  type: 'unix-epoch-ms';
}

export type DateTimeFormat =
  | Iso8601StringDateTimeFormat
  | DateObjectDateTimeFormat
  | StringDateTimeFormat
  | UnixEpochDateTimeFormat
  | UnixEpochMsDateTimeFormat;

export const ALL_CSV_CHARACTERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const;

export type CsvCharacter = typeof ALL_CSV_CHARACTERS[number];

// TODO: custom serialization with parser / transformer
// TODO: HTTP Payload (OIConnect south)
export const SERIALIZATION_TYPES = ['csv', 'oibus-values'];
export type SerializationType = typeof SERIALIZATION_TYPES[number];

export interface DateTimeSerialization {
  field: string;
  useAsReference: boolean;
  datetimeFormat: DateTimeFormat;
}

interface BaseSerializationFormat {
  type: SerializationType;
  outputDateTimeFormat: DateTimeFormat;
}

export interface FileSerializationFormat extends BaseSerializationFormat {
  type: 'csv';
  filename: string;
  compression: boolean;
  delimiter: CsvCharacter;
}

export interface OIBusValuesSerializationFormat extends BaseSerializationFormat {
  type: 'oibus-values';
}

export type Serialization = FileSerializationFormat | OIBusValuesSerializationFormat;
