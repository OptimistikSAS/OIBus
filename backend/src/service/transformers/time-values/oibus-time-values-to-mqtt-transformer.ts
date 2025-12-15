import OIBusTransformer from '../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { generateRandomId } from '../../utils';
import { OIBusMQTTValue } from '../connector-types.model';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  mapping: Array<{ pointId: string; topic: string }>;
}

export default class OIBusTimeValuesToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-mqtt';

  async transform(
    data: ReadStream | Readable,
    source: string | null,
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

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.title',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'pointId',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.point-id',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'topic',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.topic',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    };
  }
}
