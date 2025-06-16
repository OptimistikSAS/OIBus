import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
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

  public static get manifestSettings(): OIBusObjectAttribute {
    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.mapping.title',
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
                translationKey: 'configuration.oibus.manifest.transformers.mapping.point-id',
                defaultValue: null,
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
              },
              {
                type: 'string',
                key: 'nodeId',
                translationKey: 'configuration.oibus.manifest.transformers.mapping.opcua.node-id',
                defaultValue: null,
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
              },
              {
                type: 'string-select',
                key: 'dataType',
                translationKey: 'configuration.oibus.manifest.transformers.mapping.opcua.data-type',
                defaultValue: 'uint16',
                selectableValues: [
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
