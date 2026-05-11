import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusSetpoint } from '../../../../shared/model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusModbusValue } from '../../connector-types.model';
import { TransformerSetpointToModbusSettings } from '../../../../shared/model/transformer-settings.model';

export default class OIBusSetpointToModbusTransformer extends OIBusTransformer {
  public static transformerName = 'setpoint-to-modbus';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<OIBusSetpoint>, source, filename);
  }

  override async transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const setpoints: Array<OIBusSetpoint> = Array.isArray(data)
      ? (data as Array<OIBusSetpoint>)
      : (JSON.parse(String(data)) as Array<OIBusSetpoint>);

    // Index the mapping by reference once instead of scanning it N times via
    // `.find()` per setpoint. Cheap and avoids quadratic behaviour for large
    // mappings paired with large setpoint batches.
    const mappingByRef = new Map(this.options.mapping.map(m => [m.reference, m]));

    const content: Array<OIBusModbusValue> = [];
    for (const element of setpoints) {
      const mapped = mappingByRef.get(element.reference);
      if (!mapped) continue;
      content.push({
        address: mapped.address,
        value: mapped.modbusType === 'coil' ? Boolean(element.value) : parseInt(element.value as string),
        modbusType: mapped.modbusType
      });
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0,
      createdAt: '',
      numberOfElement: content.length,
      contentType: 'modbus'
    };
    return {
      output: Buffer.from(JSON.stringify(content)),
      metadata
    };
  }

  get options(): TransformerSetpointToModbusSettings {
    return this._options as TransformerSetpointToModbusSettings;
  }
}
