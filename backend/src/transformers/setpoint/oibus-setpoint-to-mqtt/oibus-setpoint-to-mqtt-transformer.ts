import OIBusTransformer from '../../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusSetpoint } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { generateRandomId } from '../../../service/utils';
import { OIBusMQTTValue } from '../../connector-types.model';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  mapping: Array<{ reference: string; topic: string }>;
}

export default class OIBusSetpointToMQTTTransformer extends OIBusTransformer {
  public static transformerName = 'setpoint-to-mqtt';

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
    const stringContent = Buffer.concat(chunks).toString('utf-8');
    // Combine the chunks into a single buffer
    const content: Array<OIBusMQTTValue> = (JSON.parse(stringContent) as Array<OIBusSetpoint>)
      .map(element => {
        const mappedElement = this.options.mapping.find(matchingElement => matchingElement.reference === element.reference);
        if (!mappedElement) return null;
        return {
          topic: mappedElement.topic,
          payload: typeof element.value === 'string' ? element.value : JSON.stringify(element.value)
        };
      })
      .filter((mappedElement): mappedElement is OIBusMQTTValue => mappedElement !== null);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'mqtt'
    };
    return {
      output: JSON.stringify(content),
      metadata
    };
  }

  get options(): TransformerOptions {
    return this._options as TransformerOptions;
  }
}
