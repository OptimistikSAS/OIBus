import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import OIBusTimeValuesToCsvTransformer from './oibus-time-values-to-csv-transformer';
import timeValuesToCsvManifest from './manifest';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import csv from 'papaparse';

jest.mock('../../../service/utils', () => ({
  sanitizeFilename: jest.fn().mockImplementation(name => name),
  formatInstant: jest.fn().mockImplementation(value => value),
  convertDelimiter: jest.fn().mockReturnValue(';'),
  convertQuoteChar: jest.fn().mockReturnValue('"'),
  convertEscapeChar: jest.fn().mockReturnValue('"'),
  convertNewline: jest.fn().mockReturnValue('')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToCsvTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: '@CurrentDate.csv',
      encoding: 'UTF_8',
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'DEFAULT',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      pointIdColumnTitle: 'Reference',
      valueColumnTitle: 'Value',
      timestampColumnTitle: 'Timestamp',
      timestampType: 'string',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timezone: 'Europe/Paris'
    };

    // Arrange
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
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
    expect(result.output).toEqual(Buffer.from('csv content'));
    expect(result.metadata).toEqual({
      contentFile: '2021_01_02_00_00_00_000.csv',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 0,
      contentType: 'any'
    });
  });

  it('should pass quoteChar, escapeChar, newline and header to csv.unparse', async () => {
    const { convertQuoteChar, convertEscapeChar, convertNewline } = jest.requireMock('../../../service/utils');
    (convertQuoteChar as jest.Mock).mockReturnValue("'");
    (convertEscapeChar as jest.Mock).mockReturnValue('\\');
    (convertNewline as jest.Mock).mockReturnValue('\r\n');
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const options = {
      filename: 'output.csv',
      encoding: 'UTF_8',
      header: false,
      delimiter: 'SEMI_COLON',
      newline: 'CRLF',
      quoteChar: 'SINGLE_QUOTE',
      escapeChar: 'BACKSLASH',
      pointIdColumnTitle: 'Ref',
      valueColumnTitle: 'Val',
      timestampColumnTitle: 'TS',
      timestampType: 'iso-string'
    };

    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ quoteChar: "'", escapeChar: '\\', newline: '\r\n', header: false, quotes: true })
    );
  });

  it('should disable quoting when quoteChar is NONE', async () => {
    const { convertQuoteChar } = jest.requireMock('../../../service/utils');
    (convertQuoteChar as jest.Mock).mockReturnValue('');
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const options = {
      filename: 'output.csv',
      encoding: 'UTF_8',
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'DEFAULT',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      pointIdColumnTitle: 'Ref',
      valueColumnTitle: 'Val',
      timestampColumnTitle: 'TS',
      timestampType: 'iso-string'
    };

    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ quotes: false }));
  });

  it('should prepend UTF-8 BOM when encoding is UTF_8_BOM', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      encoding: 'UTF_8_BOM',
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'DEFAULT',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      pointIdColumnTitle: 'Ref',
      valueColumnTitle: 'Val',
      timestampColumnTitle: 'TS',
      timestampType: 'iso-string'
    };

    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    const buf = result.output as Buffer;
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    expect(buf.subarray(3).toString('utf-8')).toBe('csv content');
  });

  it('should encode as Latin-1 Buffer when encoding is LATIN_1', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      encoding: 'LATIN_1',
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'DEFAULT',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      pointIdColumnTitle: 'Ref',
      valueColumnTitle: 'Val',
      timestampColumnTitle: 'TS',
      timestampType: 'iso-string'
    };

    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    expect((result.output as Buffer).toString('latin1')).toBe('csv content');
  });

  it('should encode as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      encoding: 'UTF_16_LE',
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'DEFAULT',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      pointIdColumnTitle: 'Ref',
      valueColumnTitle: 'Val',
      timestampColumnTitle: 'TS',
      timestampType: 'iso-string'
    };

    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    const buf = result.output as Buffer;
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xfe);
    expect(buf.subarray(2).toString('utf16le')).toBe('csv content');
  });

  it('should correctly expose the manifest settings', () => {
    // Act & Assert
    expect(timeValuesToCsvManifest.settings).toBeDefined();
    expect(timeValuesToCsvManifest.settings.type).toBe('object');
    expect(timeValuesToCsvManifest.settings.key).toBe('options');
    expect(timeValuesToCsvManifest.settings.attributes[0].key).toBe('filename');
  });

  describe('fieldProcess', () => {
    it('should apply pointIdProcess, valueProcess and timestampProcess to their respective columns', async () => {
      const { formatInstant } = jest.requireMock('../../../service/utils');
      (formatInstant as jest.Mock).mockReturnValue('2024-01-01 00:00:00');
      (csv.unparse as jest.Mock).mockReturnValue('csv result');

      const options = {
        filename: 'output.csv',
        encoding: 'UTF_8',
        header: true,
        delimiter: 'SEMI_COLON',
        newline: 'DEFAULT',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        pointIdColumnTitle: 'Ref',
        valueColumnTitle: 'Val',
        timestampColumnTitle: 'TS',
        timestampType: 'iso-string',
        pointIdProcess: 'value.toUpperCase()',
        valueProcess: 'String(value).replace(".", ",")',
        timestampProcess: 'value.slice(0, 10)'
      };

      const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '3.14' } }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      expect(csv.unparse).toHaveBeenCalledWith([{ Ref: 'REF-1', Val: '3.14', TS: '2024-01-01 00:00:00' }], expect.anything());
    });

    it('should leave column values unchanged when process fields are null', async () => {
      const { formatInstant } = jest.requireMock('../../../service/utils');
      (formatInstant as jest.Mock).mockReturnValue('2024-01-01T00:00:00.000Z');
      (csv.unparse as jest.Mock).mockReturnValue('csv result');

      const options = {
        filename: 'output.csv',
        encoding: 'UTF_8',
        header: true,
        delimiter: 'SEMI_COLON',
        newline: 'DEFAULT',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        pointIdColumnTitle: 'Ref',
        valueColumnTitle: 'Val',
        timestampColumnTitle: 'TS',
        timestampType: 'iso-string',
        pointIdProcess: null,
        valueProcess: null,
        timestampProcess: null
      };

      const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '42' } }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      expect(csv.unparse).toHaveBeenCalledWith([{ Ref: 'ref-1', Val: '42', TS: '2024-01-01T00:00:00.000Z' }], expect.anything());
    });

    it('should throw a descriptive error when a process expression is invalid', async () => {
      const { formatInstant } = jest.requireMock('../../../service/utils');
      (formatInstant as jest.Mock).mockReturnValue('2024-01-01T00:00:00.000Z');

      const options = {
        filename: 'output.csv',
        encoding: 'UTF_8',
        header: true,
        delimiter: 'SEMI_COLON',
        newline: 'DEFAULT',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        pointIdColumnTitle: 'Ref',
        valueColumnTitle: 'Val',
        timestampColumnTitle: 'TS',
        timestampType: 'iso-string',
        pointIdProcess: 'value.boom()',
        valueProcess: null,
        timestampProcess: null
      };

      const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      // Attach the rejection handler BEFORE pushing data so the rejection is never "unhandled".
      const rejectionCheck = expect(promise).rejects.toThrow('Field process evaluation failed');
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '42' } }]));
      mockStream.push(null);
      await flushPromises();
      await rejectionCheck;
    });

    it('should expose process attributes in the manifest', () => {
      const attrs = timeValuesToCsvManifest.settings.attributes;
      expect(attrs.find(a => a.key === 'pointIdProcess')).toMatchObject({ type: 'string', validators: [] });
    });
  });
});
