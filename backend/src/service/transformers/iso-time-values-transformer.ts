import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { generateRandomId } from '../utils';
import path from 'node:path';

const pipelineAsync = promisify(pipeline);

export default class IsoTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'iso-time-values';

  async transform(
    data: ReadStream | Readable,
    source: string,
    _filename: string | null
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
    // Combine the chunks into a single buffer
    const content: Array<object> = JSON.parse(stringContent);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'time-values',
      source,
      options: {}
    };
    return {
      output: stringContent,
      metadata
    };
  }
}
