import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import OIBusTimeValuesToOPCUATransformer from './oibus-time-values-to-opcua-transformer';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToOPCUATransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      mapping: [
        { pointId: 'reference1', nodeId: 'ns=3;i=1001', dataType: 'uint32' },
        { pointId: 'reference2', nodeId: 'ns=3;i=1002', dataType: 'uint32' }
      ]
    };
    // Arrange
    const transformer = new OIBusTimeValuesToOPCUATransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
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
        { nodeId: 'ns=3;i=1001', value: '1', dataType: 'uint32' },
        { nodeId: 'ns=3;i=1002', value: '2', dataType: 'uint32' }
      ]),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'opcua',
        source,
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusTimeValuesToOPCUATransformer.manifestSettings).toEqual([
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
    ]);
  });
});
