import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OibFormControl } from '../../../shared/model/form.model';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export interface OIBusMQTTValue {
  topic: string;
  payload: string;
}

interface TransformerOptions {
  mapping: Array<{ pointId: string; topic: string }>;
}

export default class OIBusTimeValuesToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: string,
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
    const stringContent = Buffer.concat(chunks).toString('utf-8');
    // Combine the chunks into a single buffer
    const content: Array<OIBusMQTTValue> = (JSON.parse(stringContent) as Array<OIBusTimeValue>)
      .map(element => {
        const mappedElement = this.options.mapping.find(matchingElement => matchingElement.pointId === element.pointId);
        if (!mappedElement) return null;
        return {
          topic: mappedElement.topic,
          payload: JSON.stringify({ ...element.data, timestamp: element.timestamp })
        };
      })
      .filter((mappedElement): mappedElement is OIBusMQTTValue => mappedElement !== null);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'mqtt',
      source,
      options: {}
    };
    return {
      output: JSON.stringify(content),
      metadata
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }

  public static get manifestSettings(): Array<OibFormControl> {
    return [
      {
        key: 'mapping',
        type: 'OibArray',
        translationKey: 'transformers.mapping.title',
        content: [
          {
            key: 'pointId',
            translationKey: 'transformers.mapping.point-id',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'topic',
            translationKey: 'transformers.mapping.mqtt.topic',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      }
    ];
  }
}
