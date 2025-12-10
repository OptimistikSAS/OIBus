import OIBusTransformer from '../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTimeToInstant, convertDelimiter, sanitizeFilename, stringToBoolean } from '../../utils';
import csv from 'papaparse';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  jsonToParse: Array<{
    regex: string;
    filename: string;
    delimiter: 'DOT' | 'SEMI_COLON' | 'COLON' | 'COMMA' | 'NON_BREAKING_SPACE' | 'SLASH' | 'TAB' | 'PIPE';
    rowIteratorPath: string;
    fields: Array<{
      jsonPath: string;
      columnName: string;
      dataType: 'string' | 'number' | 'datetime' | 'array' | 'boolean' | 'object';
      datetimeSettings: {
        type: 'iso-string' | 'unix-epoch' | 'unix-epoch-ms' | 'string';
        timezone: string;
        format: string;
        locale: string;
      };
    }>;
  }>;
}

export default class JSONToCSVTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-csv';

  async transform(data: ReadStream | Readable, source: string, filename: string): Promise<{ metadata: CacheMetadata; output: string }> {
    const jsonParser = this.options.jsonToParse.find(parser => filename.match(parser.regex));
    if (!jsonParser) {
      return this.returnEmpty(filename, source);
    }

    // Collect the data from the stream
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
    // Combine the chunks into a single buffer
    const content: object = JSON.parse(stringContent);

    // 2. Identify Rows using JSONPath
    // resultType: 'all' returns objects containing both 'path' (string) and 'value'
    const rowNodes = JSONPath({
      path: jsonParser.rowIteratorPath,
      json: content,
      resultType: 'all'
    }) as Array<{ path: string }>;

    const csvRows = rowNodes.map(rowNode => {
      // jsonpath-plus returns path as a string (e.g., "$['rows'][0]")
      // We must regex match the numbers inside brackets to get the indices.
      const pathIndices: Array<number> = [];
      const indexRegex = /\[(\d+)\]/g;
      let match;

      // Extract all integers inside brackets from the path string
      while ((match = indexRegex.exec(rowNode.path)) !== null) {
        pathIndices.push(Number(match[1]));
      }

      const csvRow: Record<string, string | number> = {};

      jsonParser.fields.forEach(field => {
        // 3. Resolve the specific path for this column
        // (This logic remains valid as long as injectIndices accepts number[])
        const specificPath = this.injectIndices(field.jsonPath, pathIndices);

        // Query the single specific value
        // wrap: false is equivalent to jp.value() (returns the item directly, not an array)
        const result = JSONPath({
          path: specificPath,
          json: content,
          wrap: false
        });

        // 4. Format Data (Unchanged)
        if (result === undefined || result === null) {
          csvRow[field.columnName] = '';
        } else {
          switch (field.dataType) {
            case 'datetime':
              csvRow[field.columnName] = convertDateTimeToInstant(result, field.datetimeSettings);
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

    // 5. Unparse the array of objects
    const outputCSV = csv.unparse(csvRows, {
      header: true,
      delimiter: convertDelimiter(jsonParser.delimiter)
    });

    const metadata: CacheMetadata = {
      contentFile: sanitizeFilename(`${jsonParser.filename}.csv`),
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any',
      source,
      options: {}
    };
    return {
      output: outputCSV,
      metadata
    };
  }

  /**
   * Helper: Replaces '*' in a JSONPath with actual indices sequentially.
   * Example: path="$.vals[*].sub[*]", indices=[0, 5] -> "$.vals[0].sub[5]"
   */
  private injectIndices(pathDefinition: string, indices: Array<number>): string {
    let indexPointer = 0;
    // Regex matches '[*]' literals
    return pathDefinition.replace(/\[\*\]/g, () => {
      // If we run out of indices (parent accessing global), we assume 0 or keep wildcard
      // But usually, we just take the next available index.
      const val = indices[indexPointer] !== undefined ? indices[indexPointer] : '*';
      indexPointer++;
      return `[${val}]`;
    });
  }

  returnEmpty(filename: string, source: string) {
    return {
      output: '',
      metadata: {
        contentFile: sanitizeFilename(`${filename}.csv`),
        contentSize: 0, // It will be set outside the transformer, once the file is written
        createdAt: '', // It will be set outside the transformer, once the file is written
        numberOfElement: 0,
        contentType: 'any',
        source,
        options: {}
      }
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'jsonToParse',
          translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.item.title',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'regex',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.regex',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'filename',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.filename',
                defaultValue: 'output',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'string-select',
                key: 'delimiter',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.delimiter',
                defaultValue: 'SEMI_COLON',
                selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'rowIteratorPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.row-iterator-path',
                defaultValue: '$[*]',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'array',
                key: 'fields',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.title',
                paginate: false,
                numberOfElementPerPage: 20,
                validators: [],
                rootAttribute: {
                  type: 'object',
                  key: 'fieldItem',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.item.title',
                  displayProperties: {
                    visible: true,
                    wrapInBox: true
                  },
                  enablingConditions: [
                    {
                      referralPathFromRoot: 'dataType',
                      targetPathFromRoot: 'datetimeSettings',
                      values: ['datetime']
                    }
                  ],
                  validators: [],
                  attributes: [
                    {
                      type: 'string',
                      key: 'columnName',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.column-name',
                      defaultValue: null,
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'string',
                      key: 'jsonPath',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.json-path',
                      defaultValue: null,
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'string-select',
                      key: 'dataType',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.data-type',
                      defaultValue: 'string',
                      selectableValues: ['string', 'number', 'datetime', 'array', 'boolean', 'object'],
                      validators: [
                        {
                          type: 'REQUIRED',
                          arguments: []
                        }
                      ],
                      displayProperties: {
                        row: 0,
                        columns: 4,
                        displayInViewMode: true
                      }
                    },
                    {
                      type: 'object',
                      key: 'datetimeSettings',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.datetime-settings.title',
                      displayProperties: {
                        visible: true,
                        wrapInBox: false
                      },
                      enablingConditions: [
                        {
                          referralPathFromRoot: 'type',
                          targetPathFromRoot: 'timezone',
                          values: ['string']
                        },
                        {
                          referralPathFromRoot: 'type',
                          targetPathFromRoot: 'format',
                          values: ['string']
                        },
                        {
                          referralPathFromRoot: 'type',
                          targetPathFromRoot: 'locale',
                          values: ['string']
                        }
                      ],
                      validators: [],
                      attributes: [
                        {
                          type: 'string-select',
                          key: 'type',
                          translationKey:
                            'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.datetime-settings.type',
                          defaultValue: 'string',
                          selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                          validators: [
                            {
                              type: 'REQUIRED',
                              arguments: []
                            }
                          ],
                          displayProperties: {
                            row: 0,
                            columns: 3,
                            displayInViewMode: true
                          }
                        },
                        {
                          type: 'timezone',
                          key: 'timezone',
                          translationKey:
                            'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.datetime-settings.timezone',
                          defaultValue: 'UTC',
                          validators: [
                            {
                              type: 'REQUIRED',
                              arguments: []
                            }
                          ],
                          displayProperties: {
                            row: 0,
                            columns: 3,
                            displayInViewMode: true
                          }
                        },
                        {
                          type: 'string',
                          key: 'format',
                          translationKey:
                            'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.datetime-settings.format',
                          defaultValue: 'yyyy-MM-dd HH:mm:ss',
                          validators: [
                            {
                              type: 'REQUIRED',
                              arguments: []
                            }
                          ],
                          displayProperties: {
                            row: 0,
                            columns: 3,
                            displayInViewMode: false
                          }
                        },
                        {
                          type: 'string',
                          key: 'locale',
                          translationKey:
                            'configuration.oibus.manifest.transformers.json-to-csv.json-to-parse.fields.datetime-settings.locale',
                          defaultValue: 'en-En',
                          validators: [
                            {
                              type: 'REQUIRED',
                              arguments: []
                            }
                          ],
                          displayProperties: {
                            row: 0,
                            columns: 3,
                            displayInViewMode: false
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    };
  }
}
