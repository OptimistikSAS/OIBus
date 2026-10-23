import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToOpcuaSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { OIBusOPCUAValue } from '../../connector-types.model';
import OIBusTransformer from '../../oibus-transformer';
import { readPointId, readValue, toRows } from '../point-record';

export default class RecordListToOPCUATransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-opcua';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Write the value of each record whose point is mapped to a node.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const mappingByPointId = new Map(this.options.mapping.map(m => [m.pointId, m]));

    const content: Array<OIBusOPCUAValue> = [];
    for (const row of toRows(data)) {
      const mapped = mappingByPointId.get(readPointId(row, this.options.pointIdColumn) ?? '');
      const value = readValue(row, this.options.valueColumn);
      if (!mapped || value === null) continue;
      content.push({ nodeId: mapped.nodeId, value });
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'opcua'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerRecordListToOpcuaSettings {
    return this._options as TransformerRecordListToOpcuaSettings;
  }
}
