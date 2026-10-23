import { DateTime } from 'luxon';

import { OIBusTimeValue } from '../../shared/model/common/content.model';
import { DateTimeType, Instant, Timezone } from '../../shared/model/common/types';

import { convertDateTime, injectIndices } from '../service/utils';
import { resolveJsonPath, resolveJsonPathRows } from './json-path';

export interface JsonTimeValuesOptions {
  rowIteratorPath: string;
  pointId: string;
  value: string;
  timestamp: string;
  datetimeSettings: { inputType: DateTimeType; inputTimezone?: Timezone; inputFormat?: string; inputLocale?: string } | null;
}

/**
 * Map each row matched by `rowIteratorPath` to a time value, reading its point ID, value and timestamp with their
 * JSONPaths (relative to the row through its indices). Rows without point ID or value are skipped; a row without
 * timestamp is stamped with the current time.
 */
export const extractJsonTimeValues = (content: object, options: JsonTimeValuesOptions): Array<OIBusTimeValue> => {
  const values: Array<OIBusTimeValue> = [];
  for (const row of resolveJsonPathRows(options.rowIteratorPath, content)) {
    const pointId = resolveJsonPath(injectIndices(options.pointId, row.indices), content);
    const value = resolveJsonPath(injectIndices(options.value, row.indices), content);
    if (pointId === undefined || pointId === null || value === undefined || value === null) continue;
    const rawTimestamp = resolveJsonPath(injectIndices(options.timestamp, row.indices), content);
    values.push({
      pointId: String(pointId),
      timestamp: toInstant(rawTimestamp, options.datetimeSettings),
      data: { value }
    });
  }
  return values;
};

/**
 * Parse the raw timestamp extracted from the payload into an ISO instant using the configured datetime settings.
 * Falls back to "now" when no timestamp could be resolved.
 */
const toInstant = (rawTimestamp: unknown, datetimeSettings: JsonTimeValuesOptions['datetimeSettings']): Instant => {
  if (rawTimestamp === undefined || rawTimestamp === null) {
    return DateTime.now().toUTC().toISO()!;
  }
  if (!datetimeSettings) {
    return DateTime.fromISO(String(rawTimestamp)).toUTC().toISO() ?? DateTime.now().toUTC().toISO()!;
  }
  return convertDateTime(
    rawTimestamp as string | number,
    {
      type: datetimeSettings.inputType,
      timezone: datetimeSettings.inputTimezone,
      format: datetimeSettings.inputFormat,
      locale: datetimeSettings.inputLocale
    },
    { type: 'iso-string', timezone: 'UTC' }
  ) as Instant;
};
