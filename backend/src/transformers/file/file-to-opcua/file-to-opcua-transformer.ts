import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerFileToOpcuaSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { generateRandomId, streamToString } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { toOPCUAValues } from '../../record-list/opcua-values';
import { readFileRows } from '../file-input';

export default class FileToOPCUATransformer extends OIBusTransformer {
  public static transformerName = 'file-to-opcua';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /** Write the value of each row of the file whose point is mapped (see `toOPCUAValues`). */
  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { rows, errors } = readFileRows(data, this.options.input, [this.options.pointIdColumn, this.options.valueColumn]);
    if (errors > 0) {
      this.logger.warn(`[FileToOPCUA] ${errors} parsing error(s) in the file of "${JSON.stringify(source)}"`);
    }
    const content = toOPCUAValues(rows, this.options);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'opcua'
    };
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerFileToOpcuaSettings {
    return this._options as TransformerFileToOpcuaSettings;
  }
}
