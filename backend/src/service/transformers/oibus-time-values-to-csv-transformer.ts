import OIBusTransformer from './oibus-transformer';
import csv from 'papaparse';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { promisify } from 'node:util';
import { OibFormControl } from '../../../shared/model/form.model';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export default class OIBusTimeValuesToCsvTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-csv';

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
    const jsonData: Array<OIBusTimeValue> = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.csv`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any',
      source,
      options: {}
    };
    return {
      output: csv.unparse(
        jsonData.map(value => ({
          pointId: value.pointId,
          timestamp: value.timestamp,
          value: value.data.value
        })),
        {
          header: true,
          delimiter: ';'
        }
      ),
      metadata
    };
  }

  public static get manifestSettings(): Array<OibFormControl> {
    return [];
  }
}
