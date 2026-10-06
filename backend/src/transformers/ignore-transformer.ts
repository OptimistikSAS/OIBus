import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { CacheMetadata } from '../../shared/model/api/engine.model';

import { CacheMetadataSource } from '../model/engine.model';
import OIBusTransformer from './oibus-transformer';

export default class IgnoreTransformer extends OIBusTransformer {
  public static transformerName = 'ignore';

  transform(
    _data: ReadStream | Readable,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return Promise.resolve({
      output: Buffer.alloc(0),
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: ''
      }
    });
  }
}
