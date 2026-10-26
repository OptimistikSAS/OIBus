import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerFileToFileSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { applyFilenameVariables, sanitizeFilename } from '../../../service/utils';
import OIBusTransformer from '../../oibus-transformer';
import { readFileRows } from '../file-input';
import { FileOutputSettings, writeFile } from '../file-output';

export default class FileToFileTransformer extends OIBusTransformer {
  public static transformerName = 'file-to-file';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const chunks: Array<Buffer> = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    return this.convert(Buffer.concat(chunks), source, filename);
  }

  override transformInMemory(
    data: unknown,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return Promise.resolve(this.convert(Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)), source, filename));
  }

  /**
   * Convert a CSV or JSON file into a CSV or JSON file (see `readFileRows` and `writeFile`), or only rename another
   * file, its content being sent as it is.
   */
  private convert(content: Buffer, source: CacheMetadataSource, filename: string | null): { metadata: CacheMetadata; output: Buffer } {
    const { input } = this.options;
    let output = content;
    let contentFile: string;
    let numberOfElement = 0;
    if (input.fileType === 'other') {
      contentFile = sanitizeFilename(applyFilenameVariables(this.options.filename, source, filename));
    } else {
      const settings = this.options as FileOutputSettings;
      const { rows, errors } = readFileRows(
        content.toString('utf-8'),
        input,
        (settings.fields ?? []).map(field => field.field)
      );
      if (errors > 0) {
        this.logger.warn(`[FileToFile] ${errors} parsing error(s) in the file of "${JSON.stringify(source)}"`);
      }
      ({ output, contentFile } = writeFile(rows, settings, source, filename));
      numberOfElement = rows.length;
    }
    const metadata: CacheMetadata = {
      contentFile,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement,
      contentType: 'file'
    };
    return { output, metadata };
  }

  get options(): TransformerFileToFileSettings {
    return this._options as TransformerFileToFileSettings;
  }
}
