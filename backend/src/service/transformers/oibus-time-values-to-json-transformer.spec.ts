import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import OIBusTimeValuesToJSONTransformer from './oibus-time-values-to-json-transformer';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToJSONTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    // Arrange
    const transformer = new OIBusTimeValuesToJSONTransformer(logger, testData.transformers.list[0], testData.north.list[0], {});
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
      output: JSON.stringify(dataChunks),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 3,
        contentType: 'any',
        source,
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusTimeValuesToJSONTransformer.manifestSettings).toEqual([]);
  });
});
