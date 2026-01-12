import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';

export default class IsoTransformer extends OIBusTransformer {
  public static transformerName = 'iso';

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

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    };
  }
}
