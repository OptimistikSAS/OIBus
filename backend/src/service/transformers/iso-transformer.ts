import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { OibFormControl } from '../../../shared/model/form.model';

export default class IsoTransformer extends OIBusTransformer {
  public static transformerName = 'iso';

  async transform(
    _data: ReadStream | Readable,
    _source: string,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    return {
      output: '',
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: '',
        source: '',
        options: {}
      }
    };
  }

  public static get manifestSettings(): Array<OibFormControl> {
    return [];
  }
}
