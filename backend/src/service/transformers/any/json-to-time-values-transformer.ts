import OIBusTransformer from '../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTimeToInstant, generateRandomId, injectIndices } from '../../utils';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  jsonToParse: Array<{
    regex: string;
    filename: string;

    // The path that defines what constitutes a "record" or "row"
    rowIteratorPath: string;

    // Paths to specific properties (can contain [*] which will be replaced by current row index)
    pointIdPath: string;
    timestampPath: string;
    valuePath: string;

    timestampSettings: {
      type: 'iso-string' | 'unix-epoch' | 'unix-epoch-ms' | 'string';
      timezone: string;
      format: string;
      locale: string;
    };
  }>;
}

export default class JSONToTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-time-values';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const jsonParser = this.options.jsonToParse.find(parser => filename.match(parser.regex));
    if (!jsonParser) {
      this.logger.error(`Could not find json parser from "${filename}"`);
      return this.returnEmpty();
    }

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

    let content: object;
    try {
      content = JSON.parse(stringContent);
    } catch (error: unknown) {
      this.logger.error(`[JSONToTimeValues] Failed to parse JSON content from "${filename}": ${(error as Error).message}`);
      return this.returnEmpty();
    }

    // 2. Identify Rows using the iterator path
    const rowNodes = JSONPath({
      path: jsonParser.rowIteratorPath,
      json: content,
      resultType: 'all'
    }) as Array<{ value: string; path: string; pointer: string; parent: string; parentProperty: string }>;

    const timeValues: Array<OIBusTimeValue> = [];

    // 3. Iterate over rows and extract fields
    for (const rowNode of rowNodes) {
      // Extract indices from the current row path (e.g. "$['items'][5]" -> [5])
      const pathIndices: Array<number> = [];
      const indexRegex = /\[(\d+)\]/g;
      let match;
      while ((match = indexRegex.exec(rowNode.path)) !== null) {
        pathIndices.push(Number(match[1]));
      }

      // Resolve specific paths for this row
      const specificIdPath = injectIndices(jsonParser.pointIdPath, pathIndices);
      const specificTimePath = injectIndices(jsonParser.timestampPath, pathIndices);
      const specificValuePath = injectIndices(jsonParser.valuePath, pathIndices);

      // Extract Data
      const pointId = this.extractSingleValue(content, specificIdPath);
      const rawTimestamp = this.extractSingleValue(content, specificTimePath);
      const rawValue = this.extractSingleValue(content, specificValuePath);

      // Validation: Ensure we have the minimum required data
      if (pointId && rawTimestamp !== null && rawTimestamp !== undefined && rawValue !== null && rawValue !== undefined) {
        timeValues.push({
          pointId: String(pointId),
          data: { value: rawValue },
          timestamp: convertDateTimeToInstant(rawTimestamp, jsonParser.timestampSettings)
        });
      }
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0,
      createdAt: '',
      numberOfElement: timeValues.length,
      contentType: 'time-values'
    };

    return {
      output: JSON.stringify(timeValues),
      metadata
    };
  }

  /**
   * Helper to extract a single value from JSONPath.
   * If the path returns an array (multiple matches), we take the first one.
   */
  private extractSingleValue(json: object, path: string): string | number {
    return JSONPath({ path, json, wrap: false });
  }

  returnEmpty(): { metadata: CacheMetadata; output: string } {
    return {
      output: '[]',
      metadata: {
        contentFile: `${generateRandomId(10)}.json`,
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'time-values'
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
          translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.item.title',
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
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.regex',
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
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.filename',
                defaultValue: 'time-values-output',
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
                key: 'rowIteratorPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.row-iterator-path',
                defaultValue: '$[*]',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 12, // Full width for the iterator
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'pointIdPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.point-id-path',
                defaultValue: '$[*].id',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 2,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'timestampPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-path',
                defaultValue: '$[*].timestamp',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 2,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'valuePath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.value-path',
                defaultValue: '$[*].value',
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 2,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'object',
                key: 'timestampSettings',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-settings.title',
                displayProperties: {
                  visible: true,
                  wrapInBox: true
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
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-settings.type',
                    defaultValue: 'iso-string',
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
                      'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-settings.timezone',
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
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-settings.format',
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
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamp-settings.locale',
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
