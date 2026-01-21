import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import OIBusTimeValuesToOIAnalyticsTransformer from './oibus-time-values-to-oianalytics-transformer';
import timeValuesToOianalyticsManifest from './manifest';

jest.mock('../../../service/utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToOIAnalyticsTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      precision: 'ms'
    };

    const transformer = new OIBusTimeValuesToOIAnalyticsTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
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
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: JSON.stringify(
        dataChunks.map(value => ({
          pointId: value.pointId,
          timestamp: value.timestamp,
          data: { value: value.data.value }
        }))
      ),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 3,
        contentType: 'oianalytics'
      }
    });
  });

  it('should properly format instant with precision', () => {
    const options = {
      precision: 'ms'
    };
    const transformer = new OIBusTimeValuesToOIAnalyticsTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    expect(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'ms')).toEqual('2020-03-15T12:34:56.789Z');
    expect(transformer.formatInstant('2020-03-15T12:34:56.789Z', 's')).toEqual('2020-03-15T12:34:56.000Z');
    expect(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'min')).toEqual('2020-03-15T12:34:00.000Z');
    expect(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'hr')).toEqual('2020-03-15T12:00:00.000Z');
  });

  it('should correctly expose the manifest settings', () => {
    // Act & Assert
    expect(timeValuesToOianalyticsManifest.settings).toBeDefined();
    expect(timeValuesToOianalyticsManifest.settings.type).toBe('object');
    expect(timeValuesToOianalyticsManifest.settings.key).toBe('options');
    // Sanity check on deep property
    expect(timeValuesToOianalyticsManifest.settings.attributes[0].key).toBe('precision');
  });
});
