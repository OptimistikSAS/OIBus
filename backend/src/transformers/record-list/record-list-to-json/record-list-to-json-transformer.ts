import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { toRows } from '../point-record';

export default class RecordListToJSONTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-json';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Write the records as a JSON file, for the North connectors expecting files.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const rows = toRows(data);
    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: rows.length,
      contentType: 'any'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(rows)), metadata });
  }
}
