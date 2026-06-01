import OIBusTransformer from '../../oibus-transformer';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { generateRandomId, streamToString } from '../../../service/utils';
import { Instant } from '../../../model/types';
import { DateTime } from 'luxon';
import { TransformerTimeValuesToOianalyticsSettings } from '../../../../shared/model/transformer-settings.model';

export default class OIBusTimeValuesToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-oianalytics';

  /**
   * Stream entry point — kept for callers that genuinely hand us a stream
   * (e.g. file-on-disk paths). Reuses `streamToString` (utils) instead of the
   * old manual `Transform` + `pipelineAsync` + `Buffer.concat` chain, and then
   * delegates to `transformInMemory` so the actual work lives in one place.
   */
  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<OIBusTimeValue>, source, filename);
  }

  /**
   * In-memory fast path. Caller in `executeTransformation` already has the
   * `Array<OIBusTimeValue>` in hand; this override skips the JSON.stringify →
   * stream → collect-chunks → JSON.parse round-trip the streaming API would
   * otherwise force.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    // Tolerate both the Array (in-memory fast path) and a serialised JSON
    // string (default base-class fallback would call us via Readable + parse).
    const values: Array<OIBusTimeValue> = Array.isArray(data)
      ? (data as Array<OIBusTimeValue>)
      : (JSON.parse(String(data)) as Array<OIBusTimeValue>);

    const precision = this.options.precision;
    const content = new Array<{ pointId: string; timestamp: Instant; data: { value: unknown } }>(values.length);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      content[i] = {
        pointId: v.pointId,
        timestamp: this.formatInstant(v.timestamp, precision),
        data: { value: v.data.value }
      };
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'oianalytics'
    };
    return Promise.resolve({
      output: Buffer.from(JSON.stringify(content)),
      metadata
    });
  }

  get options(): TransformerTimeValuesToOianalyticsSettings {
    return this._options as TransformerTimeValuesToOianalyticsSettings;
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
