import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerJsonToTimeValuesSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import { extractJsonTimeValues } from '../../json-time-values';
import OIBusTransformer from '../../oibus-transformer';

export default class JSONToTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'json-to-time-values';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const text = await streamToString(data);
    return this.transformInMemory(JSON.parse(text), source, filename);
  }

  /**
   * Each row matched by `rowIteratorPath` is mapped to a time value (see `extractJsonTimeValues`). The payload may be
   * a parsed object or its serialised JSON string (e.g. an MQTT or OIBus API payload).
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const content: object = typeof data === 'string' ? (JSON.parse(data) as object) : (data as object);
    const values = extractJsonTimeValues(content, this.options);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'time-values'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(values)), metadata });
  }

  get options(): TransformerJsonToTimeValuesSettings {
    return this._options as TransformerJsonToTimeValuesSettings;
  }
}
