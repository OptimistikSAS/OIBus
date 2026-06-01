import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusSetpoint } from '../../../../shared/model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';
import { TransformerSetpointToMqttSettings } from '../../../../shared/model/transformer-settings.model';

export default class OIBusSetpointToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'setpoint-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<OIBusSetpoint>, source, filename);
  }

  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const setpoints: Array<OIBusSetpoint> = Array.isArray(data)
      ? (data as Array<OIBusSetpoint>)
      : (JSON.parse(String(data)) as Array<OIBusSetpoint>);

    // Mapping → Map for O(1) lookup; avoids the per-setpoint .find() scan.
    const mappingByRef = new Map(this.options.mapping.map(m => [m.reference, m]));

    const content: Array<OIBusMQTTValue> = [];
    for (const element of setpoints) {
      const mapped = mappingByRef.get(element.reference);
      if (!mapped) continue;
      content.push({
        topic: mapped.topic,
        payload: typeof element.value === 'string' ? element.value : JSON.stringify(element.value)
      });
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0,
      createdAt: '',
      numberOfElement: content.length,
      contentType: 'mqtt'
    };
    return Promise.resolve({
      output: Buffer.from(JSON.stringify(content)),
      metadata
    });
  }

  get options(): TransformerSetpointToMqttSettings {
    return this._options as TransformerSetpointToMqttSettings;
  }
}
