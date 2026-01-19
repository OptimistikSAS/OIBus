import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import OIBusTimeValuesToCsvTransformer from './oibus-time-values-to-csv-transformer';
import timeValuesToCsvManifest from './manifest';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import csv from 'papaparse';
import JSONToTimeValuesTransformer from '../../any/json-to-time-values/json-to-time-values-transformer';

jest.mock('../../../service/utils', () => ({
  sanitizeFilename: jest.fn().mockImplementation(name => name),
  formatInstant: jest.fn().mockImplementation(value => value),
  convertDelimiter: jest.fn().mockReturnValue(';')
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

    const options = {
      filename: '@CurrentDate.csv',
      delimiter: 'SEMI_COLON',
      pointIdColumnTitle: 'Reference',
      valueColumnTitle: 'Value',
      timestampColumnTitle: 'Timestamp',
      timestampType: 'string',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timezone: 'Europe/Paris'
    };

    // Arrange
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
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
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: 'csv content',
      metadata: {
        contentFile: '2021_01_02_00_00_00_000.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any'
      }
    });
  });

  it('should correctly expose the manifest settings', () => {
    // Act & Assert
    expect(timeValuesToCsvManifest.settings).toBeDefined();
    expect(timeValuesToCsvManifest.settings.type).toBe('object');
    expect(timeValuesToCsvManifest.settings.key).toBe('options');
    // Sanity check on deep property
    expect(timeValuesToCsvManifest.settings.attributes[0].key).toBe('filename');
  });
});
