import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import {
  convertDateTime,
  convertDelimiter,
  convertEscapeChar,
  convertNewline,
  convertQuoteChar,
  injectIndices,
  sanitizeFilename,
  stringToBoolean
} from '../../../service/utils';
import csv from 'papaparse';
import { DateTime } from 'luxon';
import { TransformerJsonToCsvSettings } from '../../../../shared/model/transformer-settings.model';
import { applyFieldProcess } from '../../field-process';
import { resolveJsonPath, resolveJsonPathRows } from '../../json-path';

const pipelineAsync = promisify(pipeline);

export default class JSONToCSVTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-csv';

  async transform(
    data: ReadStream | Readable,
    _source: CacheMetadataSource,
    _filename: string
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    // 1. Read stream into buffer
    const chunks: Array<Buffer> = [];
    await pipelineAsync(
      data,
      new Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      })
    );
    const stringContent = Buffer.concat(chunks).toString('utf-8');
    const content: object = JSON.parse(stringContent);

    // 2. Identify rows using the iterator path (handles JSON-stringified intermediate nodes, e.g. an MQTT payload)
    const rows = resolveJsonPathRows(this.options.rowIteratorPath, content);

    // 3. Iterate over rows and extract fields
    const csvRows = rows.map(row => {
      const csvRow: Record<string, unknown> = {};
      this.options.fields.forEach(field => {
        // Resolve the specific path for this column
        const specificPath = injectIndices(field.jsonPath, row.indices);

        // Query the single specific value, parsing any JSON-stringified intermediate node
        const result = resolveJsonPath(specificPath, content);

        let typedValue: unknown;
        if (result === undefined || result === null) {
          typedValue = this.options.nullValue ?? '';
        } else {
          switch (field.dataType) {
            case 'datetime':
              typedValue = convertDateTime(
                result,
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
              typedValue = Number(result);
              break;
            case 'boolean':
              typedValue = stringToBoolean(result).toString();
              break;
            case 'string':
              typedValue = String(result);
              break;
            case 'object':
            case 'array':
            default:
              typedValue = JSON.stringify(result);
              break;
          }
        }

        csvRow[field.columnName] = applyFieldProcess(typedValue, field.fieldProcess);
      });

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

    const metadata: CacheMetadata = {
      contentFile: sanitizeFilename(
        this.options.filename.replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      ),
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any'
    };
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
    return { output, metadata };
  }

  get options(): TransformerJsonToCsvSettings {
    return this._options as TransformerJsonToCsvSettings;
  }
}
