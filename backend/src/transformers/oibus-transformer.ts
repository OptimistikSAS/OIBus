import { Transformer } from '../model/transformer.model';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { ILogger } from '../model/logger.model';

export default abstract class OIBusTransformer {
  constructor(
    protected logger: ILogger,
    protected transformer: Transformer,
    protected _options: object
  ) {}
  abstract transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }>;
}
