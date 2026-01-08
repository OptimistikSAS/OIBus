import OIBusTransformer from '../oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, CacheMetadataSource, OIBusSetpoint } from '../../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { generateRandomId } from '../../utils';
import { OIBusObjectAttribute } from '../../../../shared/model/form.model';
import { OIBusModbusValue } from '../connector-types.model';

const pipelineAsync = promisify(pipeline);

interface TransformerOptions {
  mapping: Array<{ reference: string; address: string; modbusType: 'coil' | 'register' }>;
}

export default class OIBusSetpointToModbusTransformer extends OIBusTransformer {
  public static transformerName = 'setpoint-to-modbus';

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
    const content: Array<OIBusModbusValue> = (JSON.parse(stringContent) as Array<OIBusSetpoint>)
      .map(element => {
        const mappedElement = this.options.mapping.find(matchingElement => matchingElement.reference === element.reference);
        if (!mappedElement) return null;

        return {
          address: mappedElement.address,
          value: mappedElement.modbusType === 'coil' ? Boolean(element.value) : parseInt(element.value as string),
          modbusType: mappedElement.modbusType
        };
      })
      .filter((mappedElement): mappedElement is OIBusModbusValue => mappedElement !== null);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'modbus'
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
          translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.title',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'reference',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.reference',
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
                key: 'address',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.address',
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
                key: 'modbusType',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.modbus-type',
                defaultValue: 'register',
                selectableValues: ['coil', 'register'],
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
