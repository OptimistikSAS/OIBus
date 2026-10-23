import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToModbusSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusModbusValue } from '../../connector-types.model';
import { toModbusValue } from '../../modbus-value';
import OIBusTransformer from '../../oibus-transformer';
import { readPointId, readValue, toRows } from '../point-record';

export default class RecordListToModbusTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-modbus';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Write the value of each record whose point is mapped to a coil or register, skipping the values a Modbus cannot hold.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const mappingByPointId = new Map(this.options.mapping.map(m => [m.pointId, m]));

    const content: Array<OIBusModbusValue> = [];
    for (const row of toRows(data)) {
      const pointId = readPointId(row, this.options.pointIdColumn);
      const mapped = mappingByPointId.get(pointId ?? '');
      if (!mapped) continue;
      const rawValue = readValue(row, this.options.valueColumn);
      const value = toModbusValue(rawValue, mapped.modbusType);
      if (value === null) {
        this.logger.warn(`Value "${rawValue}" of point "${pointId}" cannot be written into a Modbus ${mapped.modbusType}`);
        continue;
      }
      content.push({ address: mapped.address, value, modbusType: mapped.modbusType });
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'modbus'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerRecordListToModbusSettings {
    return this._options as TransformerRecordListToModbusSettings;
  }
}
