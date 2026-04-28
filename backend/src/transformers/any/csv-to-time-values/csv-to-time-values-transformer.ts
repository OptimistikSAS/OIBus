import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { convertDateTimeToInstant, convertDelimiter, generateRandomId } from '../../../service/utils';
import Papa from 'papaparse';
import { TransformerCsvToTimeValuesSettings } from '../../../../shared/model/transformer-settings.model';

const pipelineAsync = promisify(pipeline);

export default class CSVToTimeValuesTransformer extends OIBusTransformer {
  public static transformerName = 'csv-to-time-values';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
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
      output: Buffer.from(JSON.stringify(timeValues)),
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

  get options(): TransformerCsvToTimeValuesSettings {
    return this._options as TransformerCsvToTimeValuesSettings;
  }
}
