import OIBusTransformer from '../oibus-transformer';
import csv from 'papaparse';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { DateTime } from 'luxon';
import { convertDelimiter, formatInstant, sanitizeFilename } from '../../utils';

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

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'string',
          key: 'filename',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.filename',
          defaultValue: '@CurrentDate.csv',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'string-select',
          key: 'delimiter',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.delimiter',
          defaultValue: 'COMMA',
          selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'string',
          key: 'pointIdColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.point-id',
          defaultValue: 'Reference',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'valueColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.value',
          defaultValue: 'Value',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'timestampColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp',
          defaultValue: 'Timestamp',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string-select',
          key: 'timestampType',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-type',
          defaultValue: 'iso-string',
          selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'timestampFormat',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-format',
          defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'timezone',
          key: 'timezone',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timezone',
          defaultValue: 'UTC',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: true
          }
        }
      ],
      enablingConditions: [
        {
          referralPathFromRoot: 'timestampType',
          targetPathFromRoot: 'timezone',
          values: ['string']
        },
        {
          referralPathFromRoot: 'timestampType',
          targetPathFromRoot: 'timestampFormat',
          values: ['string']
        }
      ],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: true
      }
    };
  }
}
