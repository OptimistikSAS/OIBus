import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToMqttSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';
import OIBusTransformer from '../../oibus-transformer';
import { readPointId, toRows } from '../point-record';

export default class RecordListToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Publish each record whose point is mapped to a topic, the payload being the record without its point column.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const pointIdColumn = this.options.pointIdColumn;
    const mappingByPointId = new Map(this.options.mapping.map(m => [m.pointId, m]));

    const content: Array<OIBusMQTTValue> = [];
    for (const row of toRows(data)) {
      const mapped = mappingByPointId.get(readPointId(row, pointIdColumn) ?? '');
      if (!mapped) continue;
      const { [pointIdColumn]: _pointId, ...payload } = row;
      content.push({ topic: mapped.topic, payload: JSON.stringify(payload) });
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

  get options(): TransformerRecordListToMqttSettings {
    return this._options as TransformerRecordListToMqttSettings;
  }
}
