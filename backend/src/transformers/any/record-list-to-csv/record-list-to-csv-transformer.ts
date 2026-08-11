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
  streamToString,
  stringToBoolean
} from '../../../service/utils';
import {
  TransformerRecordListToCsvSettings,
  TransformerRecordListToCsvSettingsFields
} from '../../../../shared/model/transformer-settings.model';
import { applyFieldProcess } from '../../field-process';

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
   * untouched; per-column casting/renaming/formatting happens here, not on
   * the south side). Every field is passed through as-is unless it's covered
   * by a `fields` entry, mirroring json-to-csv's field-mapping model.
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

    const fields = this.options.fields || [];
    const configuredFieldNames = new Set(fields.map(field => field.fieldName));
    const csvRows = rows.map(row => {
      const csvRow: Record<string, unknown> = {};
      // Fields not covered by an explicit configuration pass through unchanged.
      for (const [key, value] of Object.entries(row)) {
        if (!configuredFieldNames.has(key)) csvRow[key] = value;
      }
      for (const field of fields) {
        csvRow[field.columnName || field.fieldName] = this.resolveFieldValue(row[field.fieldName], field);
      }
      return csvRow;
    });

    const quoteChar = convertQuoteChar(this.options.quoteChar);
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

  /**
   * Casts one raw field value according to its configured data type, then applies the optional
   * field-process expression — the same per-type handling json-to-csv uses.
   */
  private resolveFieldValue(rawValue: OIBusRecord[string] | undefined, field: TransformerRecordListToCsvSettingsFields): unknown {
    let typedValue: unknown;
    if (rawValue === undefined || rawValue === null) {
      typedValue = this.options.nullValue ?? '';
    } else {
      switch (field.dataType) {
        case 'datetime':
          typedValue = convertDateTime(
            rawValue as string | number,
            {
              type: field.datetimeSettings!.inputType,
              timezone: field.datetimeSettings!.inputTimezone,
              format: field.datetimeSettings!.inputFormat,
              locale: field.datetimeSettings!.inputLocale
            },
            {
              type: field.datetimeSettings!.outputType,
              timezone: field.datetimeSettings!.outputTimezone,
              format: field.datetimeSettings!.outputFormat,
              locale: field.datetimeSettings!.outputLocale
            }
          );
          break;
        case 'number':
          typedValue = Number(rawValue);
          break;
        case 'boolean':
          typedValue = (typeof rawValue === 'boolean' ? rawValue : stringToBoolean(String(rawValue))).toString();
          break;
        case 'string':
          typedValue = String(rawValue);
          break;
        case 'object':
        case 'array':
        default:
          typedValue = JSON.stringify(rawValue);
          break;
      }
    }

    return applyFieldProcess(typedValue, field.fieldProcess);
  }

  get options(): TransformerRecordListToCsvSettings {
    return this._options as TransformerRecordListToCsvSettings;
  }
}
