import OIBusTransformer from '../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTimeToInstant, generateRandomId } from '../../utils';

const pipelineAsync = promisify(pipeline);

const _testEhmartData = {
  lineName: 'FlexISLab',
  valuePreparedForTransferAt: '1972-11-06T06:39:55.117Z',
  requestedValues: {
    isoTimestampFrom: '2025-11-26T11:34:51.822+01:00',
    isoTimestampTo: '2025-11-26T11:34:51.822+01:00',
    targetAddresses: ['string', 'string'],
    logicalOutputNames: ['string', 'string'],
    limit: 1000
  },
  capturedValuesForLine: [
    {
      targetAddress: 'MC_A_SECTION_1',
      valueNameList: [
        {
          valueName: 'The name of the value',
          timingValues: [
            {
              valueCapturedAt: '1971-11-23T10:17:49.298Z',
              onAngle: 1815.9627644546395,
              offAngle: 2678.963683846316,
              drumAttributeSideInformation: 'CONVEYOR_SIDE',
              durationInMilliseconds: 4061.3033915797937
            },
            {
              valueCapturedAt: '1964-06-10T13:19:03.979Z',
              onAngle: 1352.0585998855506,
              offAngle: 5172.622999384628,
              drumAttributeSideInformation: 'CONVEYOR_SIDE',
              durationInMilliseconds: 882.9930096316518
            }
          ]
        },
        {
          valueName: 'The name of the value',
          timingValues: [
            {
              valueCapturedAt: '1982-12-26T19:07:35.921Z',
              onAngle: 8193.655002773414,
              offAngle: 3750.916677669882,
              drumAttributeSideInformation: 'BLOW_SIDE',
              durationInMilliseconds: 5472.410318915495
            },
            {
              valueCapturedAt: '1948-09-29T09:25:58.618Z',
              onAngle: 9391.360148480655,
              offAngle: 7861.320143987887,
              drumAttributeSideInformation: 'UNKNOWN',
              durationInMilliseconds: 4717.484329226838
            }
          ]
        }
      ]
    },
    {
      targetAddress: 'MC_A_SECTION_1',
      valueNameList: [
        {
          valueName: 'The name of the value',
          timingValues: [
            {
              valueCapturedAt: '1957-02-04T01:23:20.098Z',
              onAngle: 3341.9194044187716,
              offAngle: 8546.576922090922,
              drumAttributeSideInformation: 'BLANK_SIDE',
              durationInMilliseconds: 4585.372944805302
            },
            {
              valueCapturedAt: '2012-09-27T20:56:53.633Z',
              onAngle: 3890.8300622724546,
              offAngle: 6833.893635131045,
              drumAttributeSideInformation: 'MC',
              durationInMilliseconds: 5698.902705022946
            }
          ]
        },
        {
          valueName: 'The name of the value',
          timingValues: [
            {
              valueCapturedAt: '1993-07-31T11:19:57.263Z',
              onAngle: 3264.795291342741,
              offAngle: 86.64224680367872,
              drumAttributeSideInformation: 'UNKNOWN',
              durationInMilliseconds: 2068.051325576188
            },
            {
              valueCapturedAt: '2014-03-31T05:48:52.063Z',
              onAngle: 6614.463137331379,
              offAngle: 7611.345753249803,
              drumAttributeSideInformation: 'UNKNOWN',
              durationInMilliseconds: 8785.845698483508
            }
          ]
        }
      ]
    }
  ],
  nextPage: {
    isoTimestampFrom: '2025-11-26T11:34:51.822+01:00',
    isoTimestampTo: '2025-11-26T11:34:51.822+01:00',
    lineName: 'FlexISLab',
    logicalOutputNames: {
      logicalOutputName: 'Name of the value'
    },
    targetAddresses: {
      targetAddress: 'MC_A_SECTION_1'
    },
    limit: 1000
  }
};

interface TransformerOptions {
  jsonToParse: Array<{
    regex: string;
    references: string;
    timestamps: string;
    values: string;
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

  async transform(data: ReadStream | Readable, source: string, filename: string): Promise<{ metadata: CacheMetadata; output: string }> {
    const jsonParser = this.options.jsonToParse.find(parser => filename.match(parser.regex));
    if (!jsonParser) {
      return this.returnEmpty(source);
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
    let content: object = JSON.parse(stringContent);
    content = _testEhmartData;

    const references = JSONPath({ json: content, path: jsonParser.references });
    const timestamps = JSONPath({ json: content, path: jsonParser.timestamps });
    const values = JSONPath({ json: content, path: jsonParser.values });
    if (
      !references ||
      !references.length ||
      !timestamps.length ||
      !values.length ||
      timestamps.length !== values.length ||
      !(references as Array<unknown>).every(ref => ref && typeof ref === 'string')
    ) {
      return this.returnEmpty(source);
    }

    const timeValues: Array<OIBusTimeValue> = [];
    (references as Array<string>).forEach((ref, index) => {
      if (Array.isArray(timestamps[index]) && Array.isArray(values[index]) && values[index].length === timestamps[index].length) {
        // case where we have several references with several timestamps / values
        for (let i = 0; i < values[index].length; i++) {
          timeValues.push({
            pointId: ref,
            data: { value: values[index][i] },
            timestamp: convertDateTimeToInstant(timestamps[index][i], jsonParser.timestampSettings)
          });
        }
      } else if (Array.isArray(timestamps) && Array.isArray(values) && values.length === timestamps.length) {
        // case where we have one reference with several timestamps / values
        for (let i = 0; i < values.length; i++) {
          timeValues.push({
            pointId: ref,
            data: { value: values[i] },
            timestamp: convertDateTimeToInstant(timestamps[i], jsonParser.timestampSettings)
          });
        }
      } else {
        // case where we have one reference with one timestamp / value
        timeValues.push({
          pointId: ref,
          data: { value: values[index] },
          timestamp: convertDateTimeToInstant(timestamps[index], jsonParser.timestampSettings)
        });
      }
    });

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: timeValues.length,
      contentType: 'time-values',
      source,
      options: {}
    };
    return {
      output: JSON.stringify(timeValues),
      metadata
    };
  }

  returnEmpty(source: string) {
    return {
      output: '',
      metadata: {
        contentFile: `${generateRandomId(10)}.json`,
        contentSize: 0, // It will be set outside the transformer, once the file is written
        createdAt: '', // It will be set outside the transformer, once the file is written
        numberOfElement: 0,
        contentType: 'time-values',
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
          translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.title',
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
                key: 'references',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.references',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'timestamps',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.timestamps',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'values',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.json-to-parse.values',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
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
