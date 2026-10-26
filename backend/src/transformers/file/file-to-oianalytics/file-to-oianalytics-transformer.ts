import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerFileToOianalyticsSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { toOIAnalyticsPayload } from '../../record-list/oianalytics-payload';
import { readFileRows } from '../file-input';

export default class FileToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'file-to-oianalytics';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /** Send the rows of the file in the OIAnalytics compact format (see `toOIAnalyticsPayload`). */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { input, reference, timestamp, value } = this.options;
    const { rows, errors } = readFileRows(data, input, [reference.referenceField, timestamp.timestampField, value.valueField]);
    if (errors > 0) {
      this.logger.warn(`[FileToOIAnalytics] ${errors} parsing error(s) in the file of "${JSON.stringify(source)}"`);
    }
    const { content, numberOfElement } = toOIAnalyticsPayload(rows, this.options, this.logger);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement,
      contentType: 'oianalytics'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerFileToOianalyticsSettings {
    return this._options as TransformerFileToOianalyticsSettings;
  }
}
