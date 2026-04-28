import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';
import pino from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { sandboxService } from '../service/sandbox.service';
import { promisify } from 'node:util';
import { generateRandomId } from '../service/utils';

const pipelineAsync = promisify(pipeline);

export default class OIBusCustomTransformer extends OIBusTransformer {
  constructor(
    protected logger: pino.Logger,
    protected transformer: CustomTransformer,
    protected _options: object
  ) {
    super(logger, transformer, transformer);
  }

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
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
    const result = await sandboxService.execute(
      Buffer.concat(chunks).toString('utf-8'),
      source,
      filename || `${generateRandomId(10)}.json`,
      this.transformer,
      this._options,
      this.logger
    );
    return { ...result, output: Buffer.from(result.output) };
  }
}
