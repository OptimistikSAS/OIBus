import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OibFormControl } from '../../../shared/model/form.model';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export interface OIBusOPCUAValue {
  nodeId: string;
  value: string | number;
  dataType: string;
}

interface TransformerOptions {
  mapping: Array<{ pointId: string; nodeId: string; dataType: string }>;
}

export default class OIBusTimeValuesToOPCUATransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-opcua';

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
    const content: Array<OIBusOPCUAValue> = (JSON.parse(stringContent) as Array<OIBusTimeValue>)
      .map(element => {
        const mappedElement = this.options.mapping.find(matchingElement => matchingElement.pointId === element.pointId);
        if (!mappedElement) return null;
        return {
          nodeId: mappedElement.nodeId,
          value: element.data.value,
          dataType: mappedElement.dataType
        };
      })
      .filter((mappedElement): mappedElement is OIBusOPCUAValue => mappedElement !== null);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'opcua',
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
            key: 'nodeId',
            translationKey: 'transformers.mapping.opcua.node-id',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'dataType',
            type: 'OibSelect',
            options: [
              'boolean',
              's-byte',
              'byte',
              'int16',
              'uint16',
              'int32',
              'uint32',
              'int64',
              'uint64',
              'float',
              'double',
              'string',
              'date-time'
            ],
            translationKey: 'transformers.mapping.opcua.data-type',
            defaultValue: 'uint16',
            validators: [{ key: 'required' }],
            class: 'col-4',
            displayInViewMode: false
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      }
    ];
  }
}
