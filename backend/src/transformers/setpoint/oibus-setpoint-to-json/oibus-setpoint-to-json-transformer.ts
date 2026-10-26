import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { OIBusSetpoint } from '../../../../shared/model/common/content.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';

export default class OIBusSetpointToJSONTransformer extends OIBusTransformer {
  public static transformerName = 'setpoint-to-json';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(JSON.parse(await streamToString(data)), source, filename);
  }

  /**
   * Write the setpoints as a JSON file, for the North connectors expecting files.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const setpoints = (typeof data === 'string' ? JSON.parse(data) : data) as Array<OIBusSetpoint>;
    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: setpoints.length,
      contentType: 'file'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(setpoints)), metadata });
  }
}
