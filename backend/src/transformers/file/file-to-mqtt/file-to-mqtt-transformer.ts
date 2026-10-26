import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import {
  TransformerFileToMqttSettings,
  TransformerFileToMqttSettingsDatetimeSettings
} from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { convertDateTime, generateRandomId, streamToString, stringToBoolean } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';
import OIBusTransformer from '../../oibus-transformer';
import { Row } from '../../record-list/point-record';
import { readFileRows } from '../file-input';

export default class FileToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'file-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Publish a MQTT message per row with a topic: its payload is the value field formatted with the payload type, or an
   * object of the configured fields.
   */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const objectFields = this.options.payloadType === 'object' ? (this.options.objectFields ?? []) : [];
    const { rows, errors } = readFileRows(data, this.options.input, [
      this.options.topicField,
      this.options.valueField,
      ...objectFields.map(field => field.field)
    ]);
    if (errors > 0) {
      this.logger.warn(`[FileToMQTT] ${errors} parsing error(s) in the file of "${JSON.stringify(source)}"`);
    }

    const content: Array<OIBusMQTTValue> = [];
    for (const row of rows) {
      const topic = row[this.options.topicField];
      if (topic === null || topic === undefined || topic === '') continue;
      const payload = this.payloadOf(row, objectFields);
      if (payload !== null) {
        content.push({ topic: String(topic), payload });
      }
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'mqtt'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  private payloadOf(row: Row, objectFields: TransformerFileToMqttSettings['objectFields']): string | null {
    if (this.options.payloadType === 'object') {
      if (!objectFields?.length) return null;
      return JSON.stringify(
        Object.fromEntries(objectFields.map(field => [field.key, formatValue(row[field.field], field.dataType, field.datetimeSettings)]))
      );
    }
    if (!this.options.valueField) return null;
    const value = formatValue(row[this.options.valueField], this.options.payloadType, this.options.datetimeSettings);
    return value === null ? null : String(value);
  }

  get options(): TransformerFileToMqttSettings {
    return this._options as TransformerFileToMqttSettings;
  }
}

/** A field formatted with a data type, null when missing */
function formatValue(raw: unknown, type: string, datetimeSettings?: TransformerFileToMqttSettingsDatetimeSettings | null) {
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
          type: datetimeSettings!.inputType,
          timezone: datetimeSettings!.inputTimezone,
          format: datetimeSettings!.inputFormat,
          locale: datetimeSettings!.inputLocale
        },
        {
          type: datetimeSettings!.outputType,
          timezone: datetimeSettings!.outputTimezone,
          format: datetimeSettings!.outputFormat,
          locale: datetimeSettings!.outputLocale
        }
      );
    default:
      return raw;
  }
}
