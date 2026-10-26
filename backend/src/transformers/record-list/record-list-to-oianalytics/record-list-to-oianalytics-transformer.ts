import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToOianalyticsSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { toOIAnalyticsPayload } from '../oianalytics-payload';
import { toRows } from '../point-record';

export default class RecordListToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-oianalytics';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /** Send the records in the OIAnalytics compact format (see `toOIAnalyticsPayload`). */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { content, numberOfElement } = toOIAnalyticsPayload(toRows(data), this.options, this.logger);
    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement,
      contentType: 'oianalytics'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerRecordListToOianalyticsSettings {
    return this._options as TransformerRecordListToOianalyticsSettings;
  }
}
