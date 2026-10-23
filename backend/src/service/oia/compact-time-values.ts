import { DateTime } from 'luxon';

import { Instant } from '../../model/types';

/**
 * Compact time values payload accepted by the OIAnalytics `/api/oianalytics/oibus/time-values/compact` endpoints.
 * Instead of an array of `{ pointId, timestamp, value }` objects, the values are sent as three parallel
 * arrays of the same size: the i-th time value is made of the i-th element of each array. This avoids repeating the
 * field names for every value and reduces the payload size.
 */
export interface OIAnalyticsCompactTimeValues {
  timestamps: Array<Instant>;
  values: Array<unknown>;
  references: Array<string>;
}

/**
 * Minimal shape of a value that can be converted into the compact format: a point record (`{ pointId, timestamp,
 * value }`), or the legacy OIAnalytics array format (`{ pointId, timestamp, data: { value } }`) a custom transformer may
 * still produce.
 */
export interface PointValueLike {
  pointId: string;
  timestamp: Instant;
  value?: unknown;
  data?: { value?: unknown };
}

export const toCompactTimeValues = (
  values: Array<PointValueLike>,
  formatTimestamp: (timestamp: Instant) => Instant = timestamp => timestamp,
  formatReference: (reference: string) => string = reference => reference
): OIAnalyticsCompactTimeValues => {
  const compact: OIAnalyticsCompactTimeValues = {
    timestamps: new Array<Instant>(values.length),
    values: new Array<unknown>(values.length),
    references: new Array<string>(values.length)
  };
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    compact.timestamps[i] = formatTimestamp(value.timestamp);
    // undefined is not valid JSON in an array (it would be serialized as null anyway): make it explicit
    compact.values[i] = value.value ?? value.data?.value ?? null;
    compact.references[i] = formatReference(value.pointId);
  }
  return compact;
};

/**
 * Truncates an ISO instant to the given precision, in UTC: truncating in the server time zone would shift the hours of
 * time zones with a sub-hour offset (e.g. UTC+05:30).
 */
export const truncateInstant = (timestamp: Instant, precision: 'ms' | 's' | 'min' | 'hr'): Instant => {
  const instant = DateTime.fromISO(timestamp, { zone: 'utc' });
  switch (precision) {
    case 'hr':
      return instant.startOf('hour').toISO()!;
    case 'min':
      return instant.startOf('minute').toISO()!;
    case 's':
      return instant.startOf('second').toISO()!;
    case 'ms':
    default:
      return timestamp;
  }
};
