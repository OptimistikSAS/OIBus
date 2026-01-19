import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { convertDateTime, convertDelimiter, generateRandomId, stringToBoolean } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';
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
}

export default class CSVToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'csv-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    _filename: string
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

    // 2. Parse CSV Content
    const parseResult = Papa.parse(stringContent, {
      header: this.options.hasHeader,
      delimiter: convertDelimiter(this.options.delimiter),
      skipEmptyLines: true,
      dynamicTyping: true
    });

    if (parseResult.errors.length > 0) {
      this.logger.warn(
        `[CSVToMQTT] Encountered ${parseResult.errors.length} errors while parsing data from "${JSON.stringify(source)}". First error: ${parseResult.errors[0].message}`
      );
    }

    const rows = parseResult.data as Array<Record<string, string | number>>;
    const mqttMessages: Array<OIBusMQTTValue> = [];

    // 3. Iterate Rows & Extract Data
    for (const row of rows) {
      // Extract Topic
      const topic = this.extractValue(row, this.options.topicColumn, this.options.hasHeader);

      if (!topic) continue; // Topic is mandatory

      let payload: string | null = null;

      // 4. Construct Payload based on Type
      if (this.options.payloadType === 'object' && this.options.objectFields) {
        // --- CASE A: OBJECT ---
        const payloadObj: Record<string, unknown> = {};
        for (const field of this.options.objectFields) {
          const rawVal = this.extractValue(row, field.column, this.options.hasHeader);
          payloadObj[field.key] = this.formatValue(rawVal, field.dataType, field.datetimeSettings);
        }
        // Validate object is not empty
        if (Object.keys(payloadObj).length > 0) {
          payload = JSON.stringify(payloadObj);
        }
      } else if (this.options.valueColumn) {
        // --- CASE B: SIMPLE TYPE ---
        const rawVal = this.extractValue(row, this.options.valueColumn, this.options.hasHeader);

        // Format and cast
        const formatted = this.formatValue(rawVal, this.options.payloadType, this.options.datetimeSettings);

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
      contentType: 'mqtt'
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

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }
}
