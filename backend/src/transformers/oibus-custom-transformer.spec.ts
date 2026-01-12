import SandboxServiceMock from '../tests/__mocks__/service/sandbox-service.mock';
import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import OIBusCustomTransformer from './oibus-custom-transformer';
import { CustomTransformer } from '../model/transformer.model';
import SandboxService from '../service/sandbox.service';
import { OIBusTimeValue } from '../../shared/model/engine.model';
import { flushPromises } from '../tests/utils/test-utils';

const sandboxService: SandboxService = new SandboxServiceMock();

jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));

jest.mock(
  '../service/sandbox.service',
  () =>
    function () {
      return sandboxService;
    }
);

const logger: pino.Logger = new PinoLogger();

describe('OIBusCustomTransformer', () => {
  const sandboxOutput = {
    output: '',
    metadata: {
      contentFile: '',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 0,
      contentType: '',
      source: { source: 'test' }
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (sandboxService.execute as jest.Mock).mockReturnValueOnce(sandboxOutput);
  });

  it('should transform data from a stream and return sandbox result', async () => {
    // Arrange
    const transformer = new OIBusCustomTransformer(logger, testData.transformers.list[0] as CustomTransformer, testData.north.list[0], {});
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
    expect(result).toEqual(sandboxOutput);
    expect(sandboxService.execute).toHaveBeenCalledWith(
      JSON.stringify(dataChunks),
      { source: 'test' },
      'randomId.json',
      testData.transformers.list[0],
      {}
    );
  });
});
