import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToFileSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { streamToString } from '../../../service/utils';
import { FileOutputSettings, writeFile } from '../../file/file-output';
import OIBusTransformer from '../../oibus-transformer';
import { toRows } from '../point-record';

/** Without options, the records are sent as they are, in a JSON file */
const DEFAULT_SETTINGS: FileOutputSettings = {
  output: { fileType: 'json', encoding: 'UTF_8', compression: false },
  filename: '@CurrentDate.json',
  keepOtherFields: true,
  fields: []
};

export default class RecordListToFileTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-file';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /** Write the records in a CSV or JSON file, for the North connectors expecting files (see `writeFile`). */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const rows = toRows(data);
    const { output, contentFile } = writeFile(rows, this.options.output ? this.options : DEFAULT_SETTINGS, source, null, this.logger);
    const metadata: CacheMetadata = {
      contentFile,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: rows.length,
      contentType: 'file'
    };
    return Promise.resolve({ output, metadata });
  }

  get options(): TransformerRecordListToFileSettings {
    return this._options as TransformerRecordListToFileSettings;
  }
}
