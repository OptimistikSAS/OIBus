import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import OIBusTimeValuesToModbusTransformer from './oibus-time-values-to-modbus-transformer';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToModbusTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      mapping: [
        { pointId: 'reference1', address: 0x0001, modbusType: 'coil' },
        { pointId: 'reference2', address: 0x0002, modbusType: 'holding-register' }
      ]
    };
    // Arrange
    const transformer = new OIBusTimeValuesToModbusTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
    const source = 'test-source';
    const dataChunks: Array<OIBusTimeValue> = [
      {
        pointId: 'reference1',
        timestamp: testData.constants.dates.DATE_1,
        data: {
          value: '1'
        }
      },
      {
        pointId: 'reference2',
        timestamp: testData.constants.dates.DATE_2,
        data: {
          value: '2',
          quality: 'good'
        }
      },
      {
        pointId: 'reference3',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'value1'
        }
      }
    ];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, source, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: JSON.stringify([
        { address: 1, value: true, modbusType: 'coil' },
        { address: 2, value: 2, modbusType: 'holding-register' }
      ]),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'modbus',
        source,
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusTimeValuesToModbusTransformer.manifestSettings).toEqual({
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
                key: 'address',
                translationKey: 'configuration.oibus.manifest.transformers.mapping.modbus.address',
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
                translationKey: 'configuration.oibus.manifest.transformers.mapping.modbus.modbus-type',
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
    });
  });
});
