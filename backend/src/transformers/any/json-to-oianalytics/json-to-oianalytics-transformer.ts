import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { convertDateTime, generateRandomId, injectIndices, streamToString } from '../../../service/utils';
import { DateTime } from 'luxon';
import { Instant } from '../../../model/types';
import { DateTimeType } from '../../../../shared/model/types';
import { TransformerJsonToOianalyticsSettings } from '../../../../shared/model/transformer-settings.model';
import { resolveJsonPath, resolveJsonPathRows } from '../../json-path';

export default class JSONToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-oianalytics';

  /**
   * Stream entry point — kept for callers that hand us a stream (e.g. file-on-disk paths).
   * Delegates to `transformInMemory` so the actual work lives in one place.
   */
  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text), source, filename);
  }

  /**
   * In-memory fast path. The any-content payload reaching the North is already a serialised JSON
   * string, so tolerate both a parsed object and the raw string. Each row matched by
   * `rowIteratorPath` is mapped to an OIAnalytics time-value `{ pointId, timestamp, data: { value } }`.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const content: object = typeof data === 'string' ? (JSON.parse(data) as object) : (data as object);

    const rows = resolveJsonPathRows(this.options.rowIteratorPath, content);

    const values = rows.map(row => {
      const pointId = resolveJsonPath(injectIndices(this.options.pointId, row.indices), content);
      const value = resolveJsonPath(injectIndices(this.options.value, row.indices), content);
      const rawTimestamp = resolveJsonPath(injectIndices(this.options.timestamp, row.indices), content);

      return {
        pointId: String(pointId),
        timestamp: this.formatInstant(this.toInstant(rawTimestamp), this.options.datetimeSettings?.outputPrecision ?? 'ms'),
        data: { value }
      };
    });

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'oianalytics'
    };
    return Promise.resolve({
      output: Buffer.from(JSON.stringify(values)),
      metadata
    });
  }

  /**
   * Parse the raw timestamp extracted from the payload into an ISO instant using the configured
   * datetime settings. Falls back to "now" when no timestamp could be resolved.
   */
  private toInstant(rawTimestamp: unknown): Instant {
    if (rawTimestamp === undefined || rawTimestamp === null) {
      return DateTime.now().toUTC().toISO()!;
    }
    const datetimeSettings = this.options.datetimeSettings;
    if (!datetimeSettings) {
      return DateTime.fromISO(String(rawTimestamp)).toUTC().toISO() ?? (DateTime.now().toUTC().toISO() as Instant);
    }
    return convertDateTime(
      rawTimestamp as string | number,
      {
        type: datetimeSettings.inputType as DateTimeType,
        timezone: datetimeSettings.inputTimezone,
        format: datetimeSettings.inputFormat,
        locale: datetimeSettings.inputLocale
      },
      { type: 'iso-string', timezone: 'UTC' }
    ) as Instant;
  }

  get options(): TransformerJsonToOianalyticsSettings {
    return this._options as TransformerJsonToOianalyticsSettings;
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
