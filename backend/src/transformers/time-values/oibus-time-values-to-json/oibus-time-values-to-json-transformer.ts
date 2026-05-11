import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';

export default class OIBusTimeValuesToJSONTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-json';

  /**
   * Stream entry point — collects via `streamToString` (utils) and delegates
   * to the in-memory path. The stream's bytes ARE the output verbatim; only
   * the parse is needed to count `numberOfElement`.
   */
  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text) as Array<object>, source, filename);
  }

  /**
   * In-memory fast path — operates directly on the array. The previous
   * implementation triple-handled the input (concat → toString → parse →
   * stringify); this version stringifies once.
   */
  override async transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const content: Array<object> = Array.isArray(data) ? (data as Array<object>) : (JSON.parse(String(data)) as Array<object>);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'any'
    };
    return {
      output: Buffer.from(JSON.stringify(content)),
      metadata
    };
  }
}
