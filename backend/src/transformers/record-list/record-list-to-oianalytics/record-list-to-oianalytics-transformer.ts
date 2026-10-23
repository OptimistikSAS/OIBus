import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { DateTime } from 'luxon';

import { TransformerRecordListToOianalyticsSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { Instant } from '../../../model/types';
import { PointValueLike, toCompactTimeValues } from '../../../service/oia/compact-time-values';
import { generateRandomId, streamToString } from '../../../service/utils';
import { createStringFieldProcess } from '../../field-process';
import OIBusTransformer from '../../oibus-transformer';
import { readInstant, readPointId, readValue, toRows } from '../point-record';

export default class RecordListToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-oianalytics';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Read the point, timestamp and value columns of each record, and send them in the OIAnalytics compact format
   * `{ timestamps, values, references }`. Records without point, value or valid timestamp are skipped.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { pointIdColumn, timestampColumn, valueColumn, timestampSettings, precision } = this.options;
    const values: Array<PointValueLike> = [];
    let skippedRows = 0;
    for (const row of toRows(data)) {
      const pointId = readPointId(row, pointIdColumn);
      const timestamp = readInstant(row, timestampColumn, timestampSettings);
      const value = readValue(row, valueColumn);
      if (pointId === null || timestamp === null || value === null) {
        skippedRows++;
        continue;
      }
      values.push({ pointId, timestamp: this.formatInstant(timestamp, precision), value });
    }
    if (skippedRows > 0) {
      this.logger.warn(
        `${skippedRows} record(s) skipped: missing "${pointIdColumn}", "${timestampColumn}" or "${valueColumn}" value, or invalid timestamp`
      );
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'oianalytics'
    };
    const content = toCompactTimeValues(values, undefined, createStringFieldProcess(this.options.referenceProcess));
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerRecordListToOianalyticsSettings {
    return this._options as TransformerRecordListToOianalyticsSettings;
  }

  formatInstant(timestamp: Instant, precision: 'ms' | 's' | 'min' | 'hr'): Instant {
    switch (precision) {
      case 'hr':
        return DateTime.fromISO(timestamp).set({ minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
      case 'min':
        return DateTime.fromISO(timestamp).set({ second: 0, millisecond: 0 }).toUTC().toISO()!;
      case 's':
        return DateTime.fromISO(timestamp).set({ millisecond: 0 }).toUTC().toISO()!;
      case 'ms':
      default:
        return timestamp;
    }
  }
}
