import { OIBusRecord } from '../../../shared/model/common/content.model';
import { DateTimeType, Instant, Timezone } from '../../../shared/model/common/types';

import { convertDateTimeToInstant } from '../../service/utils';

/** A database driver may return date columns as Date objects, even though they are not part of the serialisable record type. */
export type RecordValue = OIBusRecord[string] | Date;
export type Row = Record<string, RecordValue>;

export interface TimestampSettings {
  type: DateTimeType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

/** The rows of a record-list payload: the in-memory array, or its serialised JSON string. */
export const toRows = (data: unknown): Array<Row> => (Array.isArray(data) ? data : (JSON.parse(String(data)) as Array<Row>));

/** The point identifier of a row, as text; null when the column is missing or empty. */
export const readPointId = (row: Row, column: string): string | null => {
  const value = row[column];
  if (value === null || value === undefined || value === '') return null;
  return value instanceof Date ? value.toISOString() : String(value);
};

/** A value as sent downstream: a date as its ISO string, null when the column is missing. */
export const readValue = (row: Row, column: string): string | number | boolean | null => {
  const value = row[column];
  if (value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * The instant of a row: a Date object (from a database driver) is used as is, any other value is parsed with the
 * timestamp settings. Returns null when the column is missing or cannot be parsed.
 */
export const readInstant = (row: Row, column: string, settings: TimestampSettings): Instant | null => {
  const value = row[column];
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  try {
    return convertDateTimeToInstant(value, settings) || null;
  } catch {
    return null;
  }
};
