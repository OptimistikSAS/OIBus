import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';

/**
 * Send the files as they are, and the payloads (JSON from MQTT or the OIBus API) as JSON files. The North caches the
 * files it receives through this transformer directly, without reading them: the transformer itself is only run to test
 * it, or on payloads.
 */
export default class FileTransformer extends OIBusTransformer {
  public static transformerName = 'file';

  async transform(
    data: ReadStream | Readable,
    _source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const chunks: Array<Buffer> = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const metadata: CacheMetadata = {
      contentFile: filename ?? `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'file'
    };
    return { output: Buffer.concat(chunks), metadata };
  }
}
