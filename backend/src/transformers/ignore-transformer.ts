import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';

export default class IgnoreTransformer extends OIBusTransformer {
  public static transformerName = 'ignore';

  async transform(
    _data: ReadStream | Readable,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    return {
      output: '',
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: ''
      }
    };
  }
}
