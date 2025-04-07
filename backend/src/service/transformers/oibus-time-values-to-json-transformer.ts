import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable, Transform, pipeline } from 'node:stream';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OibFormControl } from '../../../shared/model/form.model';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export default class OIBusTimeValuesToJSONTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-json';

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
    const content: Array<object> = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'raw',
      source,
      options: {}
    };
    return {
      output: stringContent,
      metadata
    };
  }

  public static get manifestSettings(): Array<OibFormControl> {
    return [];
  }
}
