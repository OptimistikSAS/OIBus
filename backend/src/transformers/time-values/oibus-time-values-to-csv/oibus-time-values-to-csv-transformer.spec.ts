import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type OIBusTimeValuesToCsvTransformerType from './oibus-time-values-to-csv-transformer';
import timeValuesToCsvManifest from './manifest';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockPapaparse: Record<string, ReturnType<typeof mock.fn>>;
let OIBusTimeValuesToCsvTransformer: typeof OIBusTimeValuesToCsvTransformerType;

before(() => {
  mockUtils = {
    sanitizeFilename: mock.fn((name: string) => name),
    formatInstant: mock.fn((value: string) => value),
    convertDelimiter: mock.fn(() => ';'),
    convertQuoteChar: mock.fn(() => '"'),
    convertEscapeChar: mock.fn(() => '"'),
    convertNewline: mock.fn(() => '')
  };
  mockPapaparse = { unparse: mock.fn(() => 'csv content') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  mockModule(nodeRequire, 'papaparse', mockPapaparse);
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToCsvTransformerType }>(nodeRequire, './oibus-time-values-to-csv-transformer');
  OIBusTimeValuesToCsvTransformer = mod.default;
});

describe('OIBusTimeValuesToCsvTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.sanitizeFilename = mock.fn((name: string) => name);
    mockUtils.formatInstant = mock.fn((value: string) => value);
    mockUtils.convertDelimiter = mock.fn(() => ';');
    mockUtils.convertQuoteChar = mock.fn(() => '"');
    mockUtils.convertEscapeChar = mock.fn(() => '"');
    mockUtils.convertNewline = mock.fn(() => '');
    mockPapaparse.unparse = mock.fn(() => 'csv content');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata', async () => {
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
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 'value1' } },
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_2, data: { value: 'value2', quality: 'good' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.deepStrictEqual(result, {
      output: Buffer.from('csv content'),
      metadata: {
        contentFile: '2021_01_02_00_00_00_000.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any'
      }
    });
  });

  it('should pass quoteChar, escapeChar, newline and header to csv.unparse', async () => {
    mockUtils.convertQuoteChar = mock.fn(() => "'");
    mockUtils.convertEscapeChar = mock.fn(() => '\\');
    mockUtils.convertNewline = mock.fn(() => '\r\n');
    mockPapaparse.unparse = mock.fn(() => 'csv result');

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

    const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
    const callOpts = (mockPapaparse.unparse.mock.calls[0].arguments as [unknown, Record<string, unknown>])[1];
    assert.strictEqual(callOpts.quoteChar, "'");
    assert.strictEqual(callOpts.escapeChar, '\\');
    assert.strictEqual(callOpts.newline, '\r\n');
    assert.strictEqual(callOpts.header, false);
    assert.strictEqual(callOpts.quotes, true);
  });

  it('should disable quoting when quoteChar is NONE', async () => {
    mockUtils.convertQuoteChar = mock.fn(() => '');
    mockPapaparse.unparse = mock.fn(() => 'csv result');

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

    const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
    const callOpts = (mockPapaparse.unparse.mock.calls[0].arguments as [unknown, Record<string, unknown>])[1];
    assert.strictEqual(callOpts.quotes, false);
  });

  it('should prepend UTF-8 BOM when encoding is UTF_8_BOM', async () => {
    mockPapaparse.unparse = mock.fn(() => 'csv content');

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

    const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    assert.ok(result.output instanceof Buffer);
    const buf = result.output as Buffer;
    assert.strictEqual(buf[0], 0xef);
    assert.strictEqual(buf[1], 0xbb);
    assert.strictEqual(buf[2], 0xbf);
    assert.strictEqual(buf.subarray(3).toString('utf-8'), 'csv content');
  });

  it('should encode as Latin-1 Buffer when encoding is LATIN_1', async () => {
    mockPapaparse.unparse = mock.fn(() => 'csv content');

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

    const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    assert.ok(result.output instanceof Buffer);
    assert.strictEqual((result.output as Buffer).toString('latin1'), 'csv content');
  });

  it('should encode as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE', async () => {
    mockPapaparse.unparse = mock.fn(() => 'csv content');

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

    const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify([{ pointId: 'p1', timestamp: '2024-01-01T00:00:00Z', data: { value: '1' } }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    assert.ok(result.output instanceof Buffer);
    const buf = result.output as Buffer;
    assert.strictEqual(buf[0], 0xff);
    assert.strictEqual(buf[1], 0xfe);
    assert.strictEqual(buf.subarray(2).toString('utf16le'), 'csv content');
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(timeValuesToCsvManifest.settings !== undefined);
    assert.strictEqual(timeValuesToCsvManifest.settings.type, 'object');
    assert.strictEqual(timeValuesToCsvManifest.settings.key, 'options');
    assert.strictEqual(timeValuesToCsvManifest.settings.attributes[0].key, 'filename');
  });

  describe('fieldProcess', () => {
    it('should apply pointIdProcess, valueProcess and timestampProcess to their respective columns', async () => {
      mockUtils.formatInstant = mock.fn(() => '2024-01-01 00:00:00');
      mockPapaparse.unparse = mock.fn(() => 'csv result');

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

      const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '3.14' } }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
      const callData = (mockPapaparse.unparse.mock.calls[0].arguments as [Array<Record<string, string>>, unknown])[0];
      assert.deepStrictEqual(callData, [{ Ref: 'REF-1', Val: '3,14', TS: '2024-01-01' }]);
    });

    it('should leave column values unchanged when process fields are null', async () => {
      mockUtils.formatInstant = mock.fn(() => '2024-01-01T00:00:00.000Z');
      mockPapaparse.unparse = mock.fn(() => 'csv result');

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

      const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '42' } }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
      const callData = (mockPapaparse.unparse.mock.calls[0].arguments as [Array<Record<string, string>>, unknown])[0];
      assert.deepStrictEqual(callData, [{ Ref: 'ref-1', Val: '42', TS: '2024-01-01T00:00:00.000Z' }]);
    });

    it('should throw a descriptive error when a process expression is invalid', async () => {
      mockUtils.formatInstant = mock.fn(() => '2024-01-01T00:00:00.000Z');

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

      const transformer = new OIBusTimeValuesToCsvTransformer(asLogger(logger), testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, null);
      mockStream.push(JSON.stringify([{ pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '42' } }]));
      mockStream.push(null);
      await flushPromises();
      await assert.rejects(promise, /Field process evaluation failed/);
    });

    it('should expose process attributes in the manifest', () => {
      const attrs = timeValuesToCsvManifest.settings.attributes;
      const pointIdAttr = attrs.find((a: Record<string, unknown>) => a.key === 'pointIdProcess');
      assert.ok(pointIdAttr !== undefined);
      assert.strictEqual(pointIdAttr.type, 'string');
      assert.deepStrictEqual(pointIdAttr.validators, []);
    });
  });
});
