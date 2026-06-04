import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';
import { CustomTransformer } from '../model/transformer.model';
import { sandboxService } from '../service/sandbox.service';
import { generateRandomId, streamToString } from '../service/utils';
import type { ILogger } from '../model/logger.model';

export default class OIBusCustomTransformer extends OIBusTransformer {
  constructor(
    protected logger: ILogger,
    protected transformer: CustomTransformer,
    protected _options: object
  ) {
    super(logger, transformer, transformer);
  }

  /**
   * Stream entry point — collects via `streamToString` (utils) and hands the
   * string to the sandbox. The sandbox API takes a string, so we don't bother
   * round-tripping through JSON.parse/stringify when we have one already.
   */
  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.runSandbox(text, source, filename);
  }

  /**
   * In-memory fast path — the caller has an array (or already a string). The
   * sandbox API still wants a string, so we stringify once here instead of
   * paying the JSON.stringify → stream → collect → string round-trip the base
   * class would otherwise force.
   */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return this.runSandbox(text, source, filename);
  }

  private async runSandbox(text: string, source: CacheMetadataSource, filename: string | null) {
    const result = await sandboxService.execute(
      text,
      source,
      filename || `${generateRandomId(10)}.json`,
      this.transformer,
      this._options,
      this.logger
    );
    // execute() returns a string (text/JSON, UTF-8) or an ArrayBuffer (raw binary); Buffer.from
    // unifies both into the Buffer the cache write expects.
    const output = typeof result.output === 'string' ? Buffer.from(result.output, 'utf8') : Buffer.from(result.output);
    return { ...result, output };
  }
}
