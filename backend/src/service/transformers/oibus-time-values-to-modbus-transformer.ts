import OIBusTransformer from './oibus-transformer';
import { ReadStream } from 'node:fs';
import { pipeline, Readable, Transform } from 'node:stream';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { promisify } from 'node:util';
import { OibFormControl } from '../../../shared/model/form.model';
import { generateRandomId } from '../utils';

const pipelineAsync = promisify(pipeline);

export interface OIBusModbusValue {
  address: string;
  value: number | boolean;
  modbusType: 'coil' | 'register';
}

interface TransformerOptions {
  mapping: Array<{ pointId: string; address: string; modbusType: 'coil' | 'register' }>;
}

export default class OIBusTimeValuesToModbusTransformer extends OIBusTransformer {
  public static transformerName = 'time-values-to-modbus';

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
    const content: Array<OIBusModbusValue> = (JSON.parse(stringContent) as Array<OIBusTimeValue>)
      .map(element => {
        const mappedElement = this.options.mapping.find(matchingElement => matchingElement.pointId === element.pointId);
        if (!mappedElement) return null;

        return {
          address: mappedElement.address,
          value: mappedElement.modbusType === 'coil' ? Boolean(element.data.value) : parseInt(element.data.value as string),
          modbusType: mappedElement.modbusType
        };
      })
      .filter((mappedElement): mappedElement is OIBusModbusValue => mappedElement !== null);

    const metadata: CacheMetadata = {
      contentFile: `${generateRandomId(10)}.json`,
      contentSize: 0, // It will be set outside the transformer, once the file is written
      createdAt: '', // It will be set outside the transformer, once the file is written
      numberOfElement: content.length,
      contentType: 'modbus',
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
            key: 'address',
            translationKey: 'transformers.mapping.modbus.address',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'modbusType',
            type: 'OibSelect',
            options: ['coil', 'register'],
            translationKey: 'transformers.mapping.modbus.modbus-type',
            defaultValue: 'register',
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
