import zlib from 'node:zlib';
import OIBusTransformer from '../../oibus-transformer';
import csv from 'papaparse';
import { CacheMetadata, CacheMetadataSource, OIBusRecord } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import {
  applyFilenameVariables,
  convertDateTime,
  convertDelimiter,
  convertEscapeChar,
  convertNewline,
  convertQuoteChar,
  sanitizeFilename,
  streamToString
} from '../../../service/utils';
import { TransformerRecordListToCsvSettings } from '../../../../shared/model/transformer-settings.model';

export default class RecordListToCsvTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-csv';

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
    return this.transformInMemory(JSON.parse(text) as Array<OIBusRecord>, source, filename);
  }

  /**
   * In-memory fast path — operates directly on the `Array<OIBusRecord>` that
   * the caller already has (rows are passed through by SQL-like souths
   * untouched; datetime parsing/rendering happens here, not on the south side).
   */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const rows: Array<OIBusRecord> = Array.isArray(data) ? (data as Array<OIBusRecord>) : (JSON.parse(String(data)) as Array<OIBusRecord>);

    const metadata: CacheMetadata = {
      contentFile: sanitizeFilename(applyFilenameVariables(this.options.filename, source)),
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any'
    };

    const datetimeFields = this.options.datetimeFields || [];
    const quoteChar = convertQuoteChar(this.options.quoteChar);
    const csvRows =
      datetimeFields.length === 0
        ? rows
        : rows.map(row => {
            const csvRow: OIBusRecord = { ...row };
            for (const field of datetimeFields) {
              const rawValue = row[field.fieldName];
              if (rawValue === null || rawValue === undefined || !field.input) continue;
              csvRow[field.fieldName] = convertDateTime(
                rawValue as string | number,
                {
                  type: field.input.type,
                  timezone: field.input.timezone,
                  format: field.input.format,
                  locale: field.input.locale
                },
                {
                  type: 'string',
                  timezone: field.outputTimezone,
                  format: field.outputTimestampFormat
                }
              );
            }
            return csvRow;
          });

    const outputCSV = csv.unparse(csvRows, {
      header: this.options.header || false,
      delimiter: convertDelimiter(this.options.delimiter),
      quoteChar: quoteChar || '"',
      escapeChar: convertEscapeChar(this.options.escapeChar),
      newline: convertNewline(this.options.newline),
      quotes: quoteChar !== ''
    });

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

    if (this.options.compression) {
      output = zlib.gzipSync(output);
      metadata.contentFile = `${metadata.contentFile}.gz`;
    }

    return Promise.resolve({ output, metadata });
  }

  get options(): TransformerRecordListToCsvSettings {
    return this._options as TransformerRecordListToCsvSettings;
  }
}
