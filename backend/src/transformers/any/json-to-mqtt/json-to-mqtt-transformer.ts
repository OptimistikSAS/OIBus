import OIBusTransformer from '../../oibus-transformer';
import { JSONPath } from 'jsonpath-plus';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { convertDateTime, generateRandomId, injectIndices, stringToBoolean } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';

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
}

export default class JSONToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    _source: CacheMetadataSource,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
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
      return this.returnEmpty();
    }

    // 2. Identify Rows
    const rowNodes = JSONPath({
      path: this.options.rowIteratorPath,
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
      const specificTopicPath = injectIndices(this.options.topicPath, pathIndices);
      const topic = this.extractSingleValue(content, specificTopicPath);

      if (!topic) continue; // Topic is mandatory

      let payload: string | null = null;

      // 4. Construct Payload based on Type
      if (this.options.payloadType === 'object' && this.options.objectFields) {
        // --- CASE A: OBJECT ---
        const payloadObj: Record<string, unknown> = {};
        for (const field of this.options.objectFields) {
          const specificPath = injectIndices(field.path, pathIndices);
          const rawVal = this.extractSingleValue(content, specificPath);
          payloadObj[field.key] = this.formatValue(rawVal, field.dataType, field.datetimeSettings);
        }
        // Validate object is not empty (optional logic, but good for safety)
        if (Object.keys(payloadObj).length > 0) {
          payload = JSON.stringify(payloadObj);
        }
      } else if (this.options.valuePath) {
        // --- CASE B: SIMPLE TYPE ---
        const specificPath = injectIndices(this.options.valuePath, pathIndices);
        const rawVal = this.extractSingleValue(content, specificPath);

        // Format and cast to string/number/boolean, but MQTT payload is ultimately a string/buffer
        const formatted = this.formatValue(rawVal, this.options.payloadType, this.options.datetimeSettings);

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
      contentType: 'mqtt'
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

  returnEmpty(): { metadata: CacheMetadata; output: string } {
    return {
      output: '[]',
      metadata: {
        contentFile: `${generateRandomId(10)}.json`,
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'mqtt'
      }
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }
}
