import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

export default class IsoRawTransformer extends OIBusTransformer {
  public static transformerName = 'iso-raw';

  async transform(
    data: ReadStream | Readable,
    source: string,
    cacheFilename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    // Collect the data from the stream
    const chunks: Array<Buffer> = [];
    await pipelineAsync(
      data,
      new Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      })
    );
    const stringContent = Buffer.concat(chunks).toString('utf-8');

    const metadata: CacheMetadata = {
      contentFile: cacheFilename,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'raw',
      source,
      options: {}
    };
    return {
      output: stringContent,
      metadata
    };
  }
}
