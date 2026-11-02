import { OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';

import { convertDateTimeToInstant } from '../../service/utils';

/** A database driver may return date columns as Date objects, even though they are not part of the serialisable record type. */
export type RecordValue = OIBusRecord[string] | Date;
export type Row = Record<string, RecordValue>;

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
 * The instant of a row, processed by the timestamp process, which must give an ISO date time: a Date object (from a
 * database driver) is an instant whatever the input type of a date time conversion, used as is without one. Returns null
 * when the column is missing, or when its processed value is not an ISO date time.
 */
export const readInstant = (row: Row, column: string, process: (value: unknown) => unknown): Instant | null => {
  const value = row[column];
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const processed = process(value);
  if (processed instanceof Date) return processed.toISOString();
  if (typeof processed !== 'string') return null;
  try {
    return convertDateTimeToInstant(processed, { type: 'iso-string' }) || null;
  } catch {
    return null;
  }
};
