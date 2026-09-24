import { Instant } from '../../model/types';

/**
 * Compact time values payload accepted by the OIAnalytics `/api/oianalytics/oibus/time-values/compact` endpoints.
 * Instead of an array of `{ pointId, timestamp, data: { value } }` objects, the values are sent as three parallel
 * arrays of the same size: the i-th time value is made of the i-th element of each array. This avoids repeating the
 * field names for every value and reduces the payload size.
 */
export interface OIAnalyticsCompactTimeValues {
  timestamps: Array<Instant>;
  values: Array<unknown>;
  references: Array<string>;
}

/**
 * Minimal shape of a time value that can be converted into the compact format (both `OIBusTimeValue` and the legacy
 * OIAnalytics array format match it).
 */
export interface TimeValueLike {
  pointId: string;
  timestamp: Instant;
  data: { value: unknown };
}

export const toCompactTimeValues = (
  timeValues: Array<TimeValueLike>,
  formatTimestamp: (timestamp: Instant) => Instant = timestamp => timestamp,
  formatReference: (reference: string) => string = reference => reference
): OIAnalyticsCompactTimeValues => {
  const compact: OIAnalyticsCompactTimeValues = {
    timestamps: new Array<Instant>(timeValues.length),
    values: new Array<unknown>(timeValues.length),
    references: new Array<string>(timeValues.length)
  };
  for (let i = 0; i < timeValues.length; i++) {
    const timeValue = timeValues[i];
    compact.timestamps[i] = formatTimestamp(timeValue.timestamp);
    // undefined is not valid JSON in an array (it would be serialized as null anyway): make it explicit
    compact.values[i] = timeValue.data?.value ?? null;
    compact.references[i] = formatReference(timeValue.pointId);
  }
  return compact;
};
