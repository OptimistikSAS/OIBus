import OIBusTransformer from '../oibus-transformer';
import { CacheMetadata, CacheMetadataSource, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { generateRandomId } from '../../utils';
import { Instant } from '../../../model/types';
import { DateTime } from 'luxon';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  precision: 'ms' | 's' | 'min' | 'hr';
}

export default class OIBusTimeValuesToOIAnalyticsTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-oianalytics';

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
    const content: Array<OIBusTimeValue> = (JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Array<OIBusTimeValue>).map(value => ({
      pointId: value.pointId,
      timestamp: this.formatInstant(value.timestamp, this.options.precision),
      data: { value: value.data.value }
    }));

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'oianalytics'
    };
    return {
      output: JSON.stringify(content),
      metadata
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }

  formatInstant(timestamp: Instant, precision: 'ms' | 's' | 'min' | 'hr'): Instant {
    switch (precision) {
      case 'hr':
        return DateTime.fromISO(timestamp).set({ minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
      case 'min':
        return DateTime.fromISO(timestamp).set({ second: 0, millisecond: 0 }).toUTC().toISO()!;
      case 's':
        return DateTime.fromISO(timestamp).set({ millisecond: 0 }).toUTC().toISO()!;
      case 'ms':
      default:
        return timestamp;
    }
  }

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'string-select',
          key: 'precision',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-oianalytics.precision',
          defaultValue: 'ms',
          selectableValues: ['ms', 's', 'min', 'hr'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: true
      }
    };
  }
}
