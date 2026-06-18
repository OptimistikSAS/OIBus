import OIBusTransformer from '../../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { convertDateTime, generateRandomId, injectIndices, streamToString } from '../../../service/utils';
import { DateTime } from 'luxon';
import { Instant } from '../../../model/types';
import { DateTimeType } from '../../../../shared/model/types';
import { TransformerJsonToOianalyticsSettings } from '../../../../shared/model/transformer-settings.model';

/**
 * Splits a JSONPath expression into its individual navigation segments.
 * e.g. "$[0].data.diameters[1].value" → ["$", "[0]", ".data", ".diameters", "[1]", ".value"]
 *
 * Mirrors the helper in `json-to-csv-transformer.ts`: both transformers extract values from an
 * arbitrary JSON payload via per-row JSONPaths, the only difference being the output format.
 */
function splitPathSegments(path: string): Array<string> {
  const segments: Array<string> = [];
  const regex = /\$|\.[^.[\]]+|\[[^\]]+\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    segments.push(match[0]);
  }
  return segments;
}

/**
 * Resolves a JSONPath expression against a value, automatically parsing any
 * JSON-stringified intermediate node when normal traversal would otherwise fail
 * (e.g. an MQTT message whose payload is a JSON string). Leaf strings are left untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveJsonPath(path: string, json: unknown): any {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch {
      return undefined;
    }
  }
  if (json === null || json === undefined) return undefined;

  const result = JSONPath({ path, json: json as object, wrap: false });
  if (result !== undefined && result !== null) return result;

  // Direct traversal returned nothing. Scan right-to-left through path segments
  // to find the deepest JSON-stringified intermediate node, parse it, then run
  // the remaining suffix path on the parsed value.
  const segments = splitPathSegments(path);
  for (let i = segments.length - 1; i >= 2; i--) {
    const prefix = segments.slice(0, i).join('');
    const suffix = '$' + segments.slice(i).join('');
    const intermediate = JSONPath({ path: prefix, json: json as object, wrap: false });
    if (typeof intermediate !== 'string') continue;
    try {
      const parsed = JSON.parse(intermediate);
      return resolveJsonPath(suffix, parsed);
    } catch {
      continue;
    }
  }

  return result;
}

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

    const rowNodes = JSONPath({
      path: this.options.rowIteratorPath,
      json: content,
      resultType: 'all'
    }) as Array<{ value: unknown; path: string }>;

    const values = rowNodes.map(rowNode => {
      // Extract indices from the current row path (e.g. "$['items'][5]" -> [5]) so the per-field
      // paths configured with [*] wildcards resolve to this specific row.
      const pathIndices: Array<number> = [];
      const indexRegex = /\[(\d+)\]/g;
      let match;
      while ((match = indexRegex.exec(rowNode.path)) !== null) {
        pathIndices.push(Number(match[1]));
      }

      const pointId = resolveJsonPath(injectIndices(this.options.pointId, pathIndices), content);
      const value = resolveJsonPath(injectIndices(this.options.value, pathIndices), content);
      const rawTimestamp = resolveJsonPath(injectIndices(this.options.timestamp, pathIndices), content);

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
