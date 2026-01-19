import OIBusTransformer from '../../oibus-transformer';
import csv from 'papaparse';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { promisify } from 'node:util';
import { DateTime } from 'luxon';
import { convertDelimiter, formatInstant, sanitizeFilename } from '../../../service/utils';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  filename: string;
  delimiter: 'DOT' | 'SEMI_COLON' | 'COLON' | 'COMMA' | 'NON_BREAKING_SPACE' | 'SLASH' | 'TAB' | 'PIPE';
  pointIdColumnTitle: string;
  valueColumnTitle: string;
  timestampColumnTitle: string;
  timestampType: 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';
  timestampFormat: string;
  timezone: string;
}

export default class OIBusTimeValuesToCsvTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-csv';

  async transform(
    data: ReadStream | Readable,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    // Collect the data from the stream
    const chunks: Array<Buffer> = [];
    await pipelineAsync(
      data,
      new Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      })
    );
    const jsonData: Array<OIBusTimeValue> = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    const metadata: CacheMetadata = {
      contentFile: sanitizeFilename(
        this.options.filename.replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      ),
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: 0,
      contentType: 'any'
    };
    return {
      output: csv.unparse(
        jsonData.map(value => ({
          [this.options.pointIdColumnTitle]: value.pointId,
          [this.options.timestampColumnTitle]: formatInstant(value.timestamp, {
            type: this.options.timestampType,
            timezone: this.options.timezone,
            format: this.options.timestampFormat
          }),
          [this.options.valueColumnTitle]: value.data.value
        })),
        {
          header: true,
          delimiter: convertDelimiter(this.options.delimiter)
        }
      ),
      metadata
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }
}
