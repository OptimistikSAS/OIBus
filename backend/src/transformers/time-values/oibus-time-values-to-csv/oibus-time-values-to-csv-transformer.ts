import OIBusTransformer from '../../oibus-transformer';
import csv from 'papaparse';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { DateTime } from 'luxon';
import {
  convertDelimiter,
  convertEscapeChar,
  convertNewline,
  convertQuoteChar,
  formatInstant,
  sanitizeFilename,
  streamToString
} from '../../../service/utils';
import { TransformerTimeValuesToCsvSettings } from '../../../../shared/model/transformer-settings.model';
import { applyFieldProcess } from '../../field-process';

export default class OIBusTimeValuesToCsvTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-csv';

  /**
   * Stream entry point — collects the stream via `streamToString` (utils) and
   * delegates to the in-memory path. Kept for callers that genuinely stream
   * (file-on-disk paths).
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
   * In-memory fast path — operates directly on the `Array<OIBusTimeValue>`
   * that the caller already has. Skips the JSON.stringify → stream → collect →
   * JSON.parse round-trip the streaming API would otherwise force.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const jsonData: Array<OIBusTimeValue> = Array.isArray(data)
      ? (data as Array<OIBusTimeValue>)
      : (JSON.parse(String(data)) as Array<OIBusTimeValue>);

    const metadata: CacheMetadata = {
      contentFile: sanitizeFilename(
        this.options.filename.replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      ),
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any'
    };
    const quoteChar = convertQuoteChar(this.options.quoteChar);
    // Read hot-path options once into locals so the per-element `.map` doesn't
    // hit `this.options.*` (which is a `get options()` accessor) N times.
    const pointIdProcess = this.options.pointIdProcess;
    const pointIdCol = this.options.pointIdColumnTitle;
    const timestampCol = this.options.timestampColumnTitle;
    const valueCol = this.options.valueColumnTitle;
    const timestampOpts = {
      type: this.options.timestampType,
      timezone: this.options.timezone,
      format: this.options.timestampFormat
    };
    const outputCSV = csv.unparse(
      jsonData.map(tv => ({
        [pointIdCol]: applyFieldProcess(tv.pointId, pointIdProcess),
        [timestampCol]: formatInstant(tv.timestamp, timestampOpts),
        [valueCol]: tv.data.value
      })),
      {
        header: this.options.header || false,
        delimiter: convertDelimiter(this.options.delimiter),
        quoteChar: quoteChar || '"',
        escapeChar: convertEscapeChar(this.options.escapeChar),
        newline: convertNewline(this.options.newline),
        quotes: quoteChar !== ''
      }
    );

    let output: Buffer;
    switch (this.options.encoding) {
      case 'UTF_8_BOM':
        output = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(outputCSV)]);
        break;
      case 'LATIN_1':
        output = Buffer.from(outputCSV, 'latin1');
        break;
      case 'UTF_16_LE':
        output = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(outputCSV, 'utf16le')]);
        break;
      default:
        output = Buffer.from(outputCSV);
    }
    return Promise.resolve({ output, metadata });
  }

  get options(): TransformerTimeValuesToCsvSettings {
    return this._options as TransformerTimeValuesToCsvSettings;
  }
}
