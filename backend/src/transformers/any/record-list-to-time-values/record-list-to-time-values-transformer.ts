import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { OIBusRecord, OIBusTimeValue } from '../../../../shared/model/common/content.model';
import { TransformerRecordListToTimeValuesSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { Instant } from '../../../model/types';
import { convertDateTimeToInstant, generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';

// A database driver may return date columns as Date objects, even though they are not part of the serialisable record type
type RecordValue = OIBusRecord[string] | Date;

export default class RecordListToTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-time-values';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<OIBusRecord>, source, filename);
  }

  /**
   * Map each row to a time value, read from its point ID, timestamp and value columns. Rows missing one of them, or
   * whose timestamp cannot be converted, are skipped (with a single warning).
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const rows: Array<Record<string, RecordValue>> = Array.isArray(data) ? data : JSON.parse(String(data));
    const { pointIdColumn, timestampColumn, valueColumn } = this.options;

    const values: Array<OIBusTimeValue> = [];
    let skippedRows = 0;
    for (const row of rows) {
      const pointId = row[pointIdColumn];
      const value = row[valueColumn];
      const timestamp = this.toInstant(row[timestampColumn]);
      if (pointId === null || pointId === undefined || pointId === '' || value === null || value === undefined || !timestamp) {
        skippedRows++;
        continue;
      }
      values.push({ pointId: String(pointId), timestamp, data: { value: this.toValue(value) } });
    }
    if (skippedRows > 0) {
      this.logger.warn(
        `${skippedRows} row(s) skipped: missing "${pointIdColumn}", "${timestampColumn}" or "${valueColumn}" value, or invalid timestamp`
      );
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'time-values'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(values)), metadata });
  }

  /**
   * A Date object returned by the database driver is used as is; any other value is parsed with the timestamp settings.
   * Returns null when the timestamp is missing or cannot be converted.
   */
  private toInstant(rawTimestamp: RecordValue | undefined): Instant | null {
    if (rawTimestamp instanceof Date) {
      return Number.isNaN(rawTimestamp.getTime()) ? null : rawTimestamp.toISOString();
    }
    if (rawTimestamp === null || rawTimestamp === undefined || typeof rawTimestamp === 'boolean') {
      return null;
    }
    try {
      return convertDateTimeToInstant(rawTimestamp, this.options.timestampSettings) || null;
    } catch {
      return null;
    }
  }

  /** Numbers are kept as is, any other value is sent as text (a date as an ISO string). */
  private toValue(value: RecordValue): string | number {
    if (typeof value === 'number') return value;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  get options(): TransformerRecordListToTimeValuesSettings {
    return this._options as TransformerRecordListToTimeValuesSettings;
  }
}
