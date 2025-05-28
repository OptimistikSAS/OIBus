import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import OIBusTimeValuesToCsvTransformer from './oibus-time-values-to-csv-transformer';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToCsvTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    // Arrange
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], testData.north.list[0], {});
    const source = 'test-source';
    const dataChunks: Array<OIBusTimeValue> = [
      {
        pointId: 'reference1',
        timestamp: testData.constants.dates.DATE_1,
        data: {
          value: 'value1'
        }
      },
      {
        pointId: 'reference1',
        timestamp: testData.constants.dates.DATE_2,
        data: {
          value: 'value2',
          quality: 'good'
        }
      },
      {
        pointId: 'reference2',
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
      output: 'csv content',
      metadata: {
        contentFile: 'randomId.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any',
        source,
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusTimeValuesToCsvTransformer.manifestSettings).toEqual({
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    });
  });
});
