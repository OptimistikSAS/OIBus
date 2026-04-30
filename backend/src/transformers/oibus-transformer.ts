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

  /**
   * Fast path for callers that already have the payload in memory (the common
   * case for South-emitted time-values, setpoints, and any-content). Skips the
   * `JSON.stringify` → `Readable.from` → collect-chunks → `JSON.parse`
   * round-trip that the stream-only `transform()` would otherwise force.
   *
   * Default implementation falls back to the streaming `transform()` so that
   * transformers which haven't been specialised continue to work unchanged.
   * Subclasses on hot paths (e.g. time-values-to-oianalytics) should override
   * this to operate directly on the in-memory value.
   */
  async transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const stringified = typeof data === 'string' ? data : JSON.stringify(data);
    return this.transform(Readable.from(stringified), source, filename);
  }
}
