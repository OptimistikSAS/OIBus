import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';
import { TransformerTimeValuesToMqttSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';
import OIBusTransformer from '../../oibus-transformer';

export default class OIBusTimeValuesToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<OIBusTimeValue>, source, filename);
  }

  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const values: Array<OIBusTimeValue> = Array.isArray(data)
      ? (data as Array<OIBusTimeValue>)
      : (JSON.parse(String(data)) as Array<OIBusTimeValue>);

    const mappingByPointId = new Map(this.options.mapping.map(m => [m.pointId, m]));

    const content: Array<OIBusMQTTValue> = [];
    for (const element of values) {
      const mapped = mappingByPointId.get(element.pointId);
      if (!mapped) continue;
      content.push({
        topic: mapped.topic,
        payload: JSON.stringify({ ...element.data, timestamp: element.timestamp })
      });
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'mqtt'
    };
    return Promise.resolve({
      output: Buffer.from(JSON.stringify(content)),
      metadata
    });
  }

  get options(): TransformerTimeValuesToMqttSettings {
    return this._options as TransformerTimeValuesToMqttSettings;
  }
}
