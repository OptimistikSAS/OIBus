import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import IgnoreTransformer from './ignore-transformer';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));

const logger: pino.Logger = new PinoLogger();

describe('IgnoreTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata without filename', async () => {
    // Arrange
    const transformer = new IgnoreTransformer(logger, testData.transformers.list[0], testData.north.list[0], {});
    const source = 'test-source';

    // Mock Readable stream
    const mockStream = new Readable();

    const result = await transformer.transform(mockStream, source, null);

    // Assert
    expect(result).toEqual({
      output: '',
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: '',
        source: '',
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(IgnoreTransformer.manifestSettings).toEqual({
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
