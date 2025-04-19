import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

export interface OIBusOPCUAValue {
  nodeId: string;
  value: string | number;
}

export default class OIBusTimeValuesToOPCUATransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-opcua';

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
    const content: Array<OIBusOPCUAValue> = (JSON.parse(stringContent) as Array<OIBusTimeValue>).map(element => {
      return {
        nodeId: element.pointId,
        value: element.data.value
      }; // TODO: add options (data type)
    });

    const metadata: CacheMetadata = {
      contentFile: cacheFilename,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'opcua',
      source,
      options: {}
    };
    return {
      output: JSON.stringify(content),
      metadata
    };
  }
}
