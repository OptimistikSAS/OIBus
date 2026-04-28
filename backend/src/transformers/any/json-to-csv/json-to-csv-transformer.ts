import OIBusTransformer from '../../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { convertDateTime, convertDelimiter, injectIndices, sanitizeFilename, stringToBoolean } from '../../../service/utils';
import csv from 'papaparse';
import { DateTime } from 'luxon';
import { TransformerJsonToCsvSettings } from '../../../../shared/model/transformer-settings.model';

const pipelineAsync = promisify(pipeline);

/**
 * Splits a JSONPath expression into its individual navigation segments.
 * e.g. "$[0].data.diameters[1].value" → ["$", "[0]", ".data", ".diameters", "[1]", ".value"]
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
 * JSON-stringified intermediate node when normal traversal would otherwise fail.
 * Strings that are not accessed via a path (leaf values) are left untouched.
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

export default class JSONToCSVTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-csv';

  async transform(
    data: ReadStream | Readable,
    _source: CacheMetadataSource,
    _filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
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

    // 2. Identify Rows using the iterator path
    const rowNodes = JSONPath({
      path: this.options.rowIteratorPath,
      json: content,
      resultType: 'all'
    }) as Array<{ value: string; path: string; pointer: string; parent: string; parentProperty: string }>;

    // 3. Iterate over rows and extract fields
    const csvRows = rowNodes.map(rowNode => {
      // Extract indices from the current row path (e.g. "$['items'][5]" -> [5])
      const pathIndices: Array<number> = [];
      const indexRegex = /\[(\d+)\]/g;
      let match;
      while ((match = indexRegex.exec(rowNode.path)) !== null) {
        pathIndices.push(Number(match[1]));
      }

      const csvRow: Record<string, string | number> = {};
      this.options.fields.forEach(field => {
        // Resolve the specific path for this column
        const specificPath = injectIndices(field.jsonPath, pathIndices);

        // Query the single specific value, parsing any JSON-stringified intermediate node
        const result = resolveJsonPath(specificPath, content);

        if (result === undefined || result === null) {
          csvRow[field.columnName] = '';
        } else {
          switch (field.dataType) {
            case 'datetime':
              csvRow[field.columnName] = convertDateTime(
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
              csvRow[field.columnName] = Number(result);
              break;
            case 'boolean':
              csvRow[field.columnName] = stringToBoolean(result).toString();
              break;
            case 'string':
              csvRow[field.columnName] = String(result);
              break;
            case 'object':
            case 'array':
            default:
              csvRow[field.columnName] = JSON.stringify(result);
              break;
          }
        }
      });

      return csvRow;
    });

    const outputCSV = csv.unparse(csvRows, {
      header: true,
      delimiter: convertDelimiter(this.options.delimiter)
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
    return {
      output: outputCSV,
      metadata
    };
  }

  get options(): TransformerJsonToCsvSettings {
    return this._options as TransformerJsonToCsvSettings;
  }
}
