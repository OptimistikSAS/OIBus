import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerFileToRecordListSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { readFileRows } from '../file-input';

export default class FileToRecordListTransformer extends OIBusTransformer {
  public static transformerName = 'file-to-record-list';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /** Send the rows of the file as records, with all their fields (a JSON object or array being kept as its JSON text). */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { rows, errors } = readFileRows(data, this.options.input, []);
    if (errors > 0) {
      this.logger.warn(`[FileToRecordList] ${errors} parsing error(s) in the file of "${JSON.stringify(source)}"`);
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: rows.length,
      contentType: 'record-list'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(rows)), metadata });
  }

  get options(): TransformerFileToRecordListSettings {
    return this._options as TransformerFileToRecordListSettings;
  }
}
