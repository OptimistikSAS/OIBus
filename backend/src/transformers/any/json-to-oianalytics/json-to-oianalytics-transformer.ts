import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { DateTime } from 'luxon';

import { TransformerJsonToOianalyticsSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { Instant } from '../../../model/types';
import { toCompactTimeValues } from '../../../service/oia/compact-time-values';
import { generateRandomId, streamToString } from '../../../service/utils';
import { createStringFieldProcess } from '../../field-process';
import { extractJsonTimeValues } from '../../json-time-values';
import OIBusTransformer from '../../oibus-transformer';

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
   * `rowIteratorPath` is mapped to an OIAnalytics time-value (see `extractJsonTimeValues`), and the result is sent in
   * the OIAnalytics compact format `{ timestamps, values, references }`.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const content: object = typeof data === 'string' ? (JSON.parse(data) as object) : (data as object);
    const precision = this.options.datetimeSettings?.outputPrecision ?? 'ms';
    const values = extractJsonTimeValues(content, this.options).map(value => ({
      ...value,
      timestamp: this.formatInstant(value.timestamp, precision)
    }));
    const referenceProcess = createStringFieldProcess(this.options.referenceProcess);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'oianalytics'
    };
    return Promise.resolve({
      output: Buffer.from(JSON.stringify(toCompactTimeValues(values, undefined, referenceProcess))),
      metadata
    });
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
