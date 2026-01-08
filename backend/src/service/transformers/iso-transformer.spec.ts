import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import IsoTransformer from './iso-transformer';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));

const logger: pino.Logger = new PinoLogger();

describe('IsoTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata without filename', async () => {
    // Arrange
    const transformer = new IsoTransformer(logger, testData.transformers.list[0], testData.north.list[0], {});
    const dataChunks = ['chunk1', 'chunk2', 'chunk3'];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(dataChunks[0]);
    mockStream.push(dataChunks[1]);
    mockStream.push(dataChunks[2]);
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: '',
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: ''
      }
    });
  });

  it('should transform data from a stream and return metadata', async () => {
    // Arrange
    const transformer = new IsoTransformer(logger, testData.transformers.list[0], testData.north.list[0], {});
    const filename = 'test-file.csv';
    const dataChunks = ['chunk1', 'chunk2', 'chunk3'];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, filename);
    mockStream.push(dataChunks[0]);
    mockStream.push(dataChunks[1]);
    mockStream.push(dataChunks[2]);
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: '',
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: ''
      }
    });
  });

  it('should return manifest', () => {
    expect(IsoTransformer.manifestSettings).toEqual({
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
