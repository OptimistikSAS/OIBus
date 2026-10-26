import { TransformerRecordListToOianalyticsSettings } from '../../../shared/model/connector/transformer-settings.model';

import type { ILogger } from '../../model/logger.model';
import { PointValueLike, toCompactTimeValues, truncateInstant } from '../../service/oia/compact-time-values';
import { applyFieldProcess, createStringFieldProcess } from '../field-process';
import { readInstant, readPointId, readValue, Row } from './point-record';

/** The options of an OIAnalytics payload: where to read its references, timestamps and values */
export type OIAnalyticsPayloadSettings = Pick<TransformerRecordListToOianalyticsSettings, 'reference' | 'timestamp' | 'value'>;

/**
 * Reads the reference, timestamp and value fields of each row, for the OIAnalytics compact format
 * `{ timestamps, values, references }`: the timestamps truncated to the precision, the references and values processed
 * by their expressions. Rows without reference, value or valid timestamp are skipped, with a single warning.
 */
export function toOIAnalyticsPayload(
  rows: Iterable<Row>,
  settings: OIAnalyticsPayloadSettings,
  logger: ILogger
): { content: ReturnType<typeof toCompactTimeValues>; numberOfElement: number } {
  const { reference, timestamp: timestampOptions, value: valueOptions } = settings;
  const timestampSettings = {
    type: timestampOptions.sourceType,
    timezone: timestampOptions.timezone,
    format: timestampOptions.format,
    locale: timestampOptions.locale
  };
  const values: Array<PointValueLike> = [];
  let skippedRows = 0;
  for (const row of rows) {
    const pointId = readPointId(row, reference.referenceField);
    const timestamp = readInstant(row, timestampOptions.timestampField, timestampSettings);
    const value = readValue(row, valueOptions.valueField);
    if (pointId === null || timestamp === null || value === null) {
      skippedRows++;
      continue;
    }
    values.push({
      pointId,
      timestamp: truncateInstant(timestamp, timestampOptions.precision),
      value: applyFieldProcess(value, valueOptions.valueProcess)
    });
  }
  if (skippedRows > 0) {
    logger.warn(
      `${skippedRows} record(s) skipped: missing "${reference.referenceField}", "${timestampOptions.timestampField}" or "${valueOptions.valueField}" value, or invalid timestamp`
    );
  }
  return {
    content: toCompactTimeValues(values, undefined, createStringFieldProcess(reference.referenceProcess)),
    numberOfElement: values.length
  };
}
