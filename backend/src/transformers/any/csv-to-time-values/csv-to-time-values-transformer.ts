import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { convertDateTimeToInstant, convertDelimiter, generateRandomId } from '../../../service/utils';
import Papa from 'papaparse';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  filename: string;

  // CSV Specific Settings
  delimiter: 'DOT' | 'SEMI_COLON' | 'COLON' | 'COMMA' | 'NON_BREAKING_SPACE' | 'SLASH' | 'TAB' | 'PIPE';
  hasHeader: boolean;

  // Columns can be names (if header=true) or indices (if header=false, e.g. "0")
  pointIdColumn: string;
  timestampColumn: string;
  valueColumn: string;

  timestampSettings: {
    type: 'iso-string' | 'unix-epoch' | 'unix-epoch-ms' | 'string';
    timezone: string;
    format: string;
    locale: string;
  };
}

export default class CSVToTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'csv-to-time-values';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    // 1. Read stream into buffer
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
    const stringContent = Buffer.concat(chunks).toString('utf-8');

    // 2. Parse CSV Content
    const parseResult = Papa.parse(stringContent, {
      header: this.options.hasHeader,
      delimiter: convertDelimiter(this.options.delimiter),
      skipEmptyLines: true,
      dynamicTyping: true // Automatically converts numbers and booleans
    });

    if (parseResult.errors.length > 0) {
      this.logger.warn(
        `[CSVToTimeValues] Encountered ${parseResult.errors.length} errors while parsing "${filename}". First error: ${parseResult.errors[0].message}`
      );
    }

    const rows = parseResult.data as Array<Record<string, string | number>>;
    const timeValues: Array<OIBusTimeValue> = [];

    // 3. Iterate over rows and extract fields
    for (const row of rows) {
      // Extract Data based on configuration (Header name or Index)
      const pointId = this.extractValue(row, this.options.pointIdColumn, this.options.hasHeader);
      const rawTimestamp = this.extractValue(row, this.options.timestampColumn, this.options.hasHeader);
      const rawValue = this.extractValue(row, this.options.valueColumn, this.options.hasHeader);

      // Validation: Ensure we have the minimum required data
      if (pointId && rawTimestamp !== null && rawTimestamp !== undefined && rawValue !== null && rawValue !== undefined) {
        timeValues.push({
          pointId: String(pointId),
          data: { value: rawValue },
          timestamp: convertDateTimeToInstant(rawTimestamp, this.options.timestampSettings)
        });
      }
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0,
      createdAt: '',
      numberOfElement: timeValues.length,
      contentType: 'time-values'
    };

    return {
      output: JSON.stringify(timeValues),
      metadata
    };
  }

  /**
   * Helper to safely extract value from a row (Array or Object)
   */
  private extractValue(row: Record<string, string | number>, column: string, hasHeader: boolean): string | number {
    if (hasHeader) {
      // Access by property name (e.g. row["SensorID"])
      return row[column];
    } else {
      // Access by index (e.g. row[0])
      // We parse the config string "0" to integer 0
      const index = parseInt(column, 10);
      if (isNaN(index)) return '';
      return row[index];
    }
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
          type: 'string-select',
          key: 'delimiter',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.delimiter',
          defaultValue: 'SEMI_COLON',
          selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: { row: 0, columns: 6, displayInViewMode: true }
        },
        {
          type: 'boolean',
          key: 'hasHeader',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.has-header',
          defaultValue: true,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: { row: 0, columns: 6, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'pointIdColumn',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.point-id-column',
          defaultValue: 'id',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: { row: 1, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'timestampColumn',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-column',
          defaultValue: 'timestamp',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: { row: 1, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'valueColumn',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.value-column',
          defaultValue: 'value',
          validators: [{ type: 'REQUIRED', arguments: [] }],
          displayProperties: { row: 1, columns: 4, displayInViewMode: true }
        },
        {
          type: 'object',
          key: 'timestampSettings',
          translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-settings.title',
          displayProperties: { visible: true, wrapInBox: true },
          enablingConditions: [
            { referralPathFromRoot: 'type', targetPathFromRoot: 'timezone', values: ['string'] },
            { referralPathFromRoot: 'type', targetPathFromRoot: 'format', values: ['string'] },
            { referralPathFromRoot: 'type', targetPathFromRoot: 'locale', values: ['string'] }
          ],
          validators: [],
          attributes: [
            {
              type: 'string-select',
              key: 'type',
              translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-settings.type',
              defaultValue: 'iso-string',
              selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 3, displayInViewMode: true }
            },
            {
              type: 'timezone',
              key: 'timezone',
              translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-settings.timezone',
              defaultValue: 'UTC',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 3, displayInViewMode: true }
            },
            {
              type: 'string',
              key: 'format',
              translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-settings.format',
              defaultValue: 'yyyy-MM-dd HH:mm:ss',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 3, displayInViewMode: false }
            },
            {
              type: 'string',
              key: 'locale',
              translationKey: 'configuration.oibus.manifest.transformers.csv-to-time-values.timestamp-settings.locale',
              defaultValue: 'en-En',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 3, displayInViewMode: false }
            }
          ]
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: true }
    };
  }
}
