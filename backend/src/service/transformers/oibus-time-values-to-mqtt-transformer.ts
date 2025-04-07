import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable, Transform, pipeline } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

export interface OIBusMQTTValue {
  topic: string;
  payload: string;
}

export default class OIBusTimeValuesToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-mqtt';

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
    // Combine the chunks into a single buffer
    const content: Array<OIBusMQTTValue> = (JSON.parse(stringContent) as Array<OIBusTimeValue>).map(element => {
      return {
        topic: element.pointId,
        payload: JSON.stringify({ ...element.data, timestamp: element.timestamp })
      };
    });

    const metadata: CacheMetadata = {
      contentFile: cacheFilename,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'mqtt',
      source,
      options: {}
    };
    return {
      output: JSON.stringify(content),
      metadata
    };
  }
}
