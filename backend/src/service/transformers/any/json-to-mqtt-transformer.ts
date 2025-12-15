import OIBusTransformer from '../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTime, generateRandomId, injectIndices, stringToBoolean } from '../../utils';
import { OIBusMQTTValue } from '../connector-types.model';

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

// Definition of a field within a custom Object payload
interface ObjectField {
  key: string;
  path: string;
  dataType: 'string' | 'number' | 'boolean' | 'datetime';
  datetimeSettings?: DatetimeSettings;
}

interface TransformerOptions {
  jsonToParse: Array<{
    regex: string;
    filename: string;
    rowIteratorPath: string;
    topicPath: string;

    // Payload Configuration
    payloadType: 'string' | 'number' | 'boolean' | 'datetime' | 'object';

    // 1. If payloadType is simple (string/number/boolean/datetime)
    valuePath?: string;
    datetimeSettings?: DatetimeSettings;

    // 2. If payloadType is 'object'
    objectFields?: Array<ObjectField>;
  }>;
}

export default class JSONToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: string | null,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const jsonParser = this.options.jsonToParse.find(parser => filename.match(parser.regex));
    if (!jsonParser) {
      this.logger.error(`[JSONToMQTT] Could not find json parser configuration for file "${filename}"`);
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

    let content: object;
    try {
      content = JSON.parse(stringContent);
    } catch (error: unknown) {
      this.logger.error(`[JSONToMQTT] Failed to parse JSON content from "${filename}": ${(error as Error).message}`);
      return this.returnEmpty(source);
    }

    // 2. Identify Rows
    const rowNodes = JSONPath({
      path: jsonParser.rowIteratorPath,
      json: content,
      resultType: 'all'
    }) as Array<{ value: string; path: string; pointer: string; parent: string; parentProperty: string }>;

    const mqttMessages: Array<OIBusMQTTValue> = [];

    // 3. Iterate Rows & Extract Data
    for (const rowNode of rowNodes) {
      // Calculate indices for nested arrays (e.g. replacing [*] with [0], [1]...)
      const pathIndices: Array<number> = [];
      const indexRegex = /\[(\d+)\]/g;
      let match;
      while ((match = indexRegex.exec(rowNode.path)) !== null) {
        pathIndices.push(Number(match[1]));
      }

      // Inject indices into the Topic Path
      const specificTopicPath = injectIndices(jsonParser.topicPath, pathIndices);
      const topic = this.extractSingleValue(content, specificTopicPath);

      if (!topic) continue; // Topic is mandatory

      let payload: string | null = null;

      // 4. Construct Payload based on Type
      if (jsonParser.payloadType === 'object' && jsonParser.objectFields) {
        // --- CASE A: OBJECT ---
        const payloadObj: Record<string, unknown> = {};
        for (const field of jsonParser.objectFields) {
          const specificPath = injectIndices(field.path, pathIndices);
          const rawVal = this.extractSingleValue(content, specificPath);
          payloadObj[field.key] = this.formatValue(rawVal, field.dataType, field.datetimeSettings);
        }
        // Validate object is not empty (optional logic, but good for safety)
        if (Object.keys(payloadObj).length > 0) {
          payload = JSON.stringify(payloadObj);
        }
      } else if (jsonParser.valuePath) {
        // --- CASE B: SIMPLE TYPE ---
        const specificPath = injectIndices(jsonParser.valuePath, pathIndices);
        const rawVal = this.extractSingleValue(content, specificPath);

        // Format and cast to string/number/boolean, but MQTT payload is ultimately a string/buffer
        const formatted = this.formatValue(rawVal, jsonParser.payloadType, jsonParser.datetimeSettings);

        if (formatted !== null && formatted !== undefined) {
          // If result is an object/array (unlikely given types), stringify it. Otherwise toString.
          payload = typeof formatted === 'object' ? JSON.stringify(formatted) : String(formatted);
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
   * Helper: Extracts a single value from JSONPath.
   */
  private extractSingleValue(json: object, path: string): string | number {
    return JSONPath({ path, json, wrap: false });
  }

  /**
   * Helper: Formats a raw value into the target type
   */
  private formatValue(raw: unknown, type: string, dtSettings?: DatetimeSettings) {
    if (raw === undefined || raw === null) return null;

    switch (type) {
      case 'string':
        return typeof raw !== 'object' ? String(raw) : JSON.stringify(raw);
      case 'number':
        return Number(raw);
      case 'boolean':
        return stringToBoolean(raw as string);
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
          key: 'jsonToParse',
          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.item.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [{ referralPathFromRoot: 'payloadType', targetPathFromRoot: 'payloadType', values: ['object'] }],
            validators: [],
            attributes: [
              // --- GENERAL SETTINGS ---
              {
                type: 'string',
                key: 'regex',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.regex',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'filename',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.filename',
                defaultValue: 'mqtt-output',
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'rowIteratorPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.row-iterator-path',
                defaultValue: '$[*]',
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 1, columns: 12, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'topicPath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.topic-path',
                defaultValue: '$[*].topic',
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 2, columns: 6, displayInViewMode: true }
              },
              // --- PAYLOAD TYPE SELECTION ---
              {
                type: 'string-select',
                key: 'payloadType',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.payload-type',
                defaultValue: 'object',
                selectableValues: ['string', 'number', 'boolean', 'datetime', 'object'],
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 2, columns: 6, displayInViewMode: true }
              },
              // --- SIMPLE VALUE CONFIG (Hidden if type is object) ---
              {
                type: 'string',
                key: 'valuePath',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.value-path',
                defaultValue: '$[*].value',
                validators: [],
                displayProperties: { row: 2, columns: 4, displayInViewMode: true }
              },
              // --- DATETIME SETTINGS (Hidden if type is not datetime) ---
              {
                type: 'object',
                key: 'datetimeSettings',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.title',
                displayProperties: { visible: true, wrapInBox: true },
                enablingConditions: [{ referralPathFromRoot: 'payloadType', targetPathFromRoot: 'payloadType', values: ['datetime'] }],
                validators: [],
                attributes: [
                  {
                    type: 'string-select',
                    key: 'type',
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.type',
                    defaultValue: 'iso-string',
                    selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'timezone',
                    key: 'timezone',
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.timezone',
                    defaultValue: 'UTC',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                  },
                  {
                    type: 'string',
                    key: 'format',
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.format',
                    defaultValue: 'yyyy-MM-dd HH:mm:ss',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                  },
                  {
                    type: 'string',
                    key: 'locale',
                    translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.locale',
                    defaultValue: 'en-En',
                    validators: [{ type: 'REQUIRED', arguments: [] }],
                    displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                  }
                ]
              },
              // --- OBJECT FIELDS CONFIG (Hidden if type is not object) ---
              {
                type: 'array',
                key: 'objectFields',
                translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.object-fields.title',
                paginate: false,
                numberOfElementPerPage: 20,
                validators: [],
                rootAttribute: {
                  type: 'object',
                  key: 'field',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.object-fields.item.title',
                  displayProperties: { visible: true, wrapInBox: true },
                  enablingConditions: [{ referralPathFromRoot: 'dataType', targetPathFromRoot: 'datetimeSettings', values: ['datetime'] }],
                  validators: [],
                  attributes: [
                    {
                      type: 'string',
                      key: 'key',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.object-fields.key',
                      defaultValue: 'key',
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    {
                      type: 'string',
                      key: 'path',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.object-fields.path',
                      defaultValue: '$[*].val',
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    {
                      type: 'string-select',
                      key: 'dataType',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.object-fields.data-type',
                      defaultValue: 'string',
                      selectableValues: ['string', 'number', 'boolean', 'datetime'],
                      validators: [{ type: 'REQUIRED', arguments: [] }],
                      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                    },
                    // Datetime settings specifically for object fields
                    {
                      type: 'object',
                      key: 'datetimeSettings',
                      translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.title',
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
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.type',
                          defaultValue: 'iso-string',
                          selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'timezone',
                          key: 'inputTimezone',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.timezone',
                          defaultValue: 'UTC',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'string',
                          key: 'inputFormat',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.format',
                          defaultValue: 'yyyy-MM-dd HH:mm:ss',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string',
                          key: 'inputLocale',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.locale',
                          defaultValue: 'en-En',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string-select',
                          key: 'outputType',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.type',
                          defaultValue: 'iso-string',
                          selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'timezone',
                          key: 'outputTimezone',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.timezone',
                          defaultValue: 'UTC',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: true }
                        },
                        {
                          type: 'string',
                          key: 'outputFormat',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.format',
                          defaultValue: 'yyyy-MM-dd HH:mm:ss',
                          validators: [{ type: 'REQUIRED', arguments: [] }],
                          displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                        },
                        {
                          type: 'string',
                          key: 'outputLocale',
                          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.json-to-parse.datetime-settings.locale',
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
