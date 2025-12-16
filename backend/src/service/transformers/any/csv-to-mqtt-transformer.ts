import OIBusTransformer from '../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTime, convertDelimiter, generateRandomId, stringToBoolean } from '../../utils';
import { OIBusMQTTValue } from '../connector-types.model';
import Papa from 'papaparse';

const pipelineAsync = promisify(pipeline);

// Reusable interface for Datetime Settings
interface DatetimeSettings {
  inputType: 'iso-string' | 'unix-epoch' | 'unix-epoch-ms' | 'string';
  inputTimezone?: string;
  inputFormat?: string;
  inputLocale?: string;
  outputType: 'iso-string' | 'unix-epoch' | 'unix-epoch-ms' | 'string';
  outputTimezone?: string;
  outputFormat?: string;
  outputLocale?: string;
}

// Definition of a field within a custom Object payload for CSV
interface CSVObjectField {
  key: string;
  column: string; // Replaces 'path' from JSON transformer
  dataType: 'string' | 'number' | 'boolean' | 'datetime';
  datetimeSettings?: DatetimeSettings;
}

interface TransformerOptions {
  csvToParse: Array<{
    regex: string;
    filename: string;

    // CSV Specific Settings
    delimiter: 'DOT' | 'SEMI_COLON' | 'COLON' | 'COMMA' | 'NON_BREAKING_SPACE' | 'SLASH' | 'TAB' | 'PIPE';
    hasHeader: boolean;

    // MQTT Configuration
    topicColumn: string;

    // Payload Configuration
    payloadType: 'string' | 'number' | 'boolean' | 'datetime' | 'object';

    // 1. If payloadType is simple (string/number/boolean/datetime)
    valueColumn?: string;
    datetimeSettings?: DatetimeSettings;

    // 2. If payloadType is 'object'
    objectFields?: Array<CSVObjectField>;
  }>;
}

export default class CSVToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'csv-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: string | null,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const csvParser = this.options.csvToParse.find(parser => filename.match(parser.regex));
    if (!csvParser) {
      this.logger.error(`[CSVToMQTT] Could not find csv parser configuration for file "${filename}"`);
      return this.returnEmpty(source);
    }

    // 1. Read Stream
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

    // 2. Parse CSV Content
    const parseResult = Papa.parse(stringContent, {
      header: csvParser.hasHeader,
      delimiter: convertDelimiter(csvParser.delimiter),
      skipEmptyLines: true,
      dynamicTyping: true
    });

    if (parseResult.errors.length > 0) {
      this.logger.warn(
        `[CSVToMQTT] Encountered ${parseResult.errors.length} errors while parsing "${filename}". First error: ${parseResult.errors[0].message}`
      );
    }

    const rows = parseResult.data as Array<Record<string, string | number>>;
    const mqttMessages: Array<OIBusMQTTValue> = [];

    // 3. Iterate Rows & Extract Data
    for (const row of rows) {
      // Extract Topic
      const topic = this.extractValue(row, csvParser.topicColumn, csvParser.hasHeader);

      if (!topic) continue; // Topic is mandatory

      let payload: string | null = null;

      // 4. Construct Payload based on Type
      if (csvParser.payloadType === 'object' && csvParser.objectFields) {
        // --- CASE A: OBJECT ---
        const payloadObj: Record<string, unknown> = {};
        for (const field of csvParser.objectFields) {
          const rawVal = this.extractValue(row, field.column, csvParser.hasHeader);
          payloadObj[field.key] = this.formatValue(rawVal, field.dataType, field.datetimeSettings);
        }
        // Validate object is not empty
        if (Object.keys(payloadObj).length > 0) {
          payload = JSON.stringify(payloadObj);
        }
      } else if (csvParser.valueColumn) {
        // --- CASE B: SIMPLE TYPE ---
        const rawVal = this.extractValue(row, csvParser.valueColumn, csvParser.hasHeader);

        // Format and cast
        const formatted = this.formatValue(rawVal, csvParser.payloadType, csvParser.datetimeSettings);

        if (formatted !== null && formatted !== undefined) {
          payload = String(formatted);
        }
      }

      // 5. Add to output if valid
      if (payload !== null) {
        mqttMessages.push({
          topic: String(topic),
          payload: payload
        });
      }
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0,
      createdAt: '',
      numberOfElement: mqttMessages.length,
      contentType: 'mqtt',
      source,
      options: {}
    };

    return {
      output: JSON.stringify(mqttMessages),
      metadata
    };
  }

  /**
   * Helper: Extracts a single value from a CSV Row (Object or Array).
   */
  private extractValue(row: Record<string, string | number>, column: string, hasHeader: boolean): string | number | undefined {
    if (hasHeader) {
      // Access by property name (e.g. row["SensorID"])
      return row[column];
    } else {
      // Access by index (e.g. row[0])
      const index = parseInt(column, 10);
      if (isNaN(index)) return undefined;
      return row[index];
    }
  }

  /**
   * Helper: Formats a raw value into the target type
   */
  private formatValue(raw: unknown, type: string, dtSettings?: DatetimeSettings) {
    if (raw === undefined || raw === null) return null;

    switch (type) {
      case 'string':
        return String(raw);
      case 'number':
        return Number(raw);
      case 'boolean':
        return stringToBoolean(String(raw));
      case 'datetime':
        return convertDateTime(
          raw as string | number,
          {
            type: dtSettings!.inputType,
            timezone: dtSettings!.inputTimezone,
            format: dtSettings!.inputFormat,
            locale: dtSettings!.inputLocale
          },
          {
            type: dtSettings!.outputType,
            timezone: dtSettings!.outputTimezone,
            format: dtSettings!.outputFormat,
            locale: dtSettings!.outputLocale
          }
        );
      default:
        return raw;
    }
  }

  returnEmpty(source: string | null) {
    return {
      output: '[]',
      metadata: {
        contentFile: `${generateRandomId(10)}.json`,
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'mqtt',
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
          key: 'csvToParse',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.item.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [
              { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'datetimeSettings', values: ['datetime'] },
              { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'objectFields', values: ['object'] },
              {
                referralPathFromRoot: 'payloadType',
                targetPathFromRoot: 'valueColumn',
                values: ['string', 'number', 'boolean']
              }
            ],
            validators: [],
            attributes: [
              // --- GENERAL SETTINGS ---
              {
                type: 'string',
                key: 'regex',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.regex',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'filename',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.filename',
                defaultValue: 'mqtt-output',
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              // --- CSV FORMAT SETTINGS ---
              {
                type: 'string-select',
                key: 'delimiter',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.delimiter',
                defaultValue: 'SEMI_COLON',
                selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 1, columns: 6, displayInViewMode: true }
              },
              {
                type: 'boolean',
                key: 'hasHeader',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.has-header',
                defaultValue: true,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 1, columns: 6, displayInViewMode: true }
              },
              // --- MQTT TOPIC ---
              {
                type: 'string',
                key: 'topicColumn',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.topic-column',
                defaultValue: 'topic',
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 2, columns: 6, displayInViewMode: true }
              },
              // --- PAYLOAD TYPE SELECTION ---
              {
                type: 'string-select',
                key: 'payloadType',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.payload-type',
                defaultValue: 'object',
                selectableValues: ['string', 'number', 'boolean', 'datetime', 'object'],
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 2, columns: 6, displayInViewMode: true }
              },
              // --- SIMPLE VALUE CONFIG (Hidden if type is object) ---
              {
                type: 'string',
                key: 'valueColumn',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.value-column',
                defaultValue: 'value',
                validators: [],
                displayProperties: { row: 3, columns: 4, displayInViewMode: true }
              },
              // --- DATETIME SETTINGS (Hidden if type is not datetime) ---
              {
                type: 'object',
                key: 'datetimeSettings',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.title',
                displayProperties: { visible: true, wrapInBox: true },
                enablingConditions: [
                  { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputTimezone', values: ['string'] },
                  { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputFormat', values: ['string'] },
                  { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputLocale', values: ['string'] },
                  { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputTimezone', values: ['string'] },
                  { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputFormat', values: ['string'] },
                  { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputLocale', values: ['string'] }
                ],
                validators: [],
                attributes: [
                  {
                    type: 'string-select',
                    key: 'inputType',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.input-type',
                    defaultValue: 'iso-string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'timezone',
                    key: 'inputTimezone',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.timezone',
                    defaultValue: 'UTC',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'string',
                    key: 'inputFormat',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                  },
                  {
                    type: 'string',
                    key: 'inputLocale',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.locale',
                    defaultValue: 'en-En',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                  },
                  {
                    type: 'string-select',
                    key: 'outputType',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.output-type',
                    defaultValue: 'iso-string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'timezone',
                    key: 'outputTimezone',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.timezone',
                    defaultValue: 'UTC',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'string',
                    key: 'outputFormat',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                  },
                  {
                    type: 'string',
                    key: 'outputLocale',
                    translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.locale',
                    defaultValue: 'en-En',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                  }
                ]
              },
              // --- OBJECT FIELDS CONFIG (Hidden if type is not object) ---
              {
                type: 'array',
                key: 'objectFields',
                translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.title',
                paginate: false,
                numberOfElementPerPage: 20,
                validators: [],
                rootAttribute: {
                  type: 'object',
                  key: 'field',
                  translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.item.title',
                  displayProperties: { visible: true, wrapInBox: true },
                  enablingConditions: [{ referralPathFromRoot: 'dataType', targetPathFromRoot: 'datetimeSettings', values: ['datetime'] }],
                  validators: [],
                  attributes: [
                    {
                      type: 'string',
                      key: 'key',
                      translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.key',
                      defaultValue: 'key',
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    {
                      type: 'string',
                      key: 'column',
                      translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.column',
                      defaultValue: 'val',
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    {
                      type: 'string-select',
                      key: 'dataType',
                      translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.data-type',
                      defaultValue: 'string',
                      selectableValues: ['string', 'number', 'boolean', 'datetime'],
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    {
                      type: 'object',
                      key: 'datetimeSettings',
                      translationKey:
                        'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.object-fields.datetime-settings.title',
                      displayProperties: { visible: true, wrapInBox: false },
                      enablingConditions: [
                        { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputTimezone', values: ['string'] },
                        { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputFormat', values: ['string'] },
                        { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputLocale', values: ['string'] },
                        { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputTimezone', values: ['string'] },
                        { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputFormat', values: ['string'] },
                        { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputLocale', values: ['string'] }
                      ],
                      validators: [],
                      attributes: [
                        {
                          type: 'string-select',
                          key: 'inputType',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.input-type',
                          defaultValue: 'iso-string',
                          selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'timezone',
                          key: 'inputTimezone',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.timezone',
                          defaultValue: 'UTC',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'string',
                          key: 'inputFormat',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.format',
                          defaultValue: 'yyyy-MM-dd HH:mm:ss',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string',
                          key: 'inputLocale',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.locale',
                          defaultValue: 'en-En',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string-select',
                          key: 'outputType',
                          translationKey:
                            'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.output-type',
                          defaultValue: 'iso-string',
                          selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'timezone',
                          key: 'outputTimezone',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.timezone',
                          defaultValue: 'UTC',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'string',
                          key: 'outputFormat',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.format',
                          defaultValue: 'yyyy-MM-dd HH:mm:ss',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string',
                          key: 'outputLocale',
                          translationKey: 'configuration.oibus.manifest.transformers.csv-to-mqtt.csv-to-parse.datetime-settings.locale',
                          defaultValue: 'en-En',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: false }
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
      displayProperties: { visible: true, wrapInBox: false }
    };
  }
}
