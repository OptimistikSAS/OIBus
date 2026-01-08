import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../shared/model/engine.model';
import pino from 'pino';
import { CustomTransformer } from '../../model/transformer.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import SandboxService from '../sandbox.service';
import { promisify } from 'node:util';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export default class OIBusCustomTransformer extends OIBusTransformer {
  private sandboxService: SandboxService;

  constructor(
    protected logger: pino.Logger,
    protected transformer: CustomTransformer,
    protected northConnector: NorthConnectorEntity<NorthSettings>,
    protected _options: object
  ) {
    super(logger, transformer, northConnector, transformer);
    this.sandboxService = new SandboxService(logger);
  }

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
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
    return await this.sandboxService.execute(
      Buffer.concat(chunks).toString('utf-8'),
      source,
      filename || `${generateRandomId(10)}.json`,
      this.transformer,
      this._options
    );
  }
}
