import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { TransformerRecordListToOianalyticsSettings } from '../../../../shared/model/connector/transformer-settings.model';
import { CacheMetadata } from '../../../../shared/model/domain/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import { PointValueLike, toCompactTimeValues, truncateInstant } from '../../../service/oia/compact-time-values';
import { generateRandomId, streamToString } from '../../../service/utils';
import { applyFieldProcess, createStringFieldProcess } from '../../field-process';
import OIBusTransformer from '../../oibus-transformer';
import { readInstant, readPointId, readValue, toRows } from '../point-record';

export default class RecordListToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'record-list-to-oianalytics';

  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    return this.transformInMemory(await streamToString(data), source, filename);
  }

  /**
   * Read the reference, timestamp and value fields of each record, and send them in the OIAnalytics compact format
   * `{ timestamps, values, references }`, the timestamps truncated to the precision, the references and values processed
   * by their expressions. Records without reference, value or valid timestamp are skipped.
   */
  override transformInMemory(
    data: unknown,
    _source: CacheMetadataSource,
    _filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const { reference, timestamp: timestampOptions, value: valueOptions } = this.options;
    const timestampSettings = {
      type: timestampOptions.sourceType,
      timezone: timestampOptions.timezone,
      format: timestampOptions.format,
      locale: timestampOptions.locale
    };
    const values: Array<PointValueLike> = [];
    let skippedRows = 0;
    for (const row of toRows(data)) {
      const pointId = readPointId(row, reference.referenceField);
      const timestamp = readInstant(row, timestampOptions.timestampField, timestampSettings);
      const value = readValue(row, valueOptions.valueField);
      if (pointId === null || timestamp === null || value === null) {
        skippedRows++;
        continue;
      }
      values.push({
        pointId,
        timestamp: truncateInstant(timestamp, timestampOptions.precision),
        value: applyFieldProcess(value, valueOptions.valueProcess)
      });
    }
    if (skippedRows > 0) {
      this.logger.warn(
        `${skippedRows} record(s) skipped: missing "${reference.referenceField}", "${timestampOptions.timestampField}" or "${valueOptions.valueField}" value, or invalid timestamp`
      );
    }

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: values.length,
      contentType: 'oianalytics'
    };
    const content = toCompactTimeValues(values, undefined, createStringFieldProcess(reference.referenceProcess));
    return Promise.resolve({ output: Buffer.from(JSON.stringify(content)), metadata });
  }

  get options(): TransformerRecordListToOianalyticsSettings {
    return this._options as TransformerRecordListToOianalyticsSettings;
  }
}
