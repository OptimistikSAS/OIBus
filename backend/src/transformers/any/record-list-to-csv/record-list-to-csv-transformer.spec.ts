import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import { applyFilenameVariables, streamToString } from '../../../service/utils';
import type RecordListToCsvTransformerType from './record-list-to-csv-transformer';
import recordListToCsvManifest from './manifest';
import { OIBusRecord } from '../../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockPapaparse: Record<string, ReturnType<typeof mock.fn>>;
let RecordListToCsvTransformer: typeof RecordListToCsvTransformerType;

before(() => {
  mockUtils = {
    sanitizeFilename: mock.fn((name: string) => name),
    convertDateTime: mock.fn((value: unknown) => value),
    stringToBoolean: mock.fn((value: string) => value === 'true'),
    convertDelimiter: mock.fn(() => ';'),
    convertQuoteChar: mock.fn(() => '"'),
    convertEscapeChar: mock.fn(() => '"'),
    convertNewline: mock.fn(() => ''),
    streamToString: mock.fn(streamToString),
    applyFilenameVariables: mock.fn(applyFilenameVariables)
  };
  mockPapaparse = { unparse: mock.fn(() => 'csv content') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  mockModule(nodeRequire, 'papaparse', mockPapaparse);
  const mod = reloadModule<{ default: typeof RecordListToCsvTransformerType }>(nodeRequire, './record-list-to-csv-transformer');
  RecordListToCsvTransformer = mod.default;
});

describe('RecordListToCsvTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.sanitizeFilename = mock.fn((name: string) => name);
    mockUtils.convertDateTime = mock.fn((value: unknown) => value);
    mockUtils.stringToBoolean = mock.fn((value: string) => value === 'true');
    mockUtils.convertDelimiter = mock.fn(() => ';');
    mockUtils.convertQuoteChar = mock.fn(() => '"');
    mockUtils.convertEscapeChar = mock.fn(() => '"');
    mockUtils.convertNewline = mock.fn(() => '');
    mockUtils.applyFilenameVariables = mock.fn(applyFilenameVariables);
    mockPapaparse.unparse = mock.fn(() => 'csv content');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  const baseOptions = {
    filename: '@CurrentDate.csv',
    encoding: 'UTF_8',
    header: true,
    compression: false,
    delimiter: 'SEMI_COLON',
    newline: 'DEFAULT',
    quoteChar: 'DOUBLE_QUOTE',
    escapeChar: 'DOUBLE_QUOTE',
    nullValue: '',
    fields: null
  };

  it('should transform record-list data from a stream and return metadata', async () => {
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], baseOptions);
    const rows: Array<OIBusRecord> = [
      { id: 1, name: 'sensor1', value: 23.5 },
      { id: 2, name: 'sensor2', value: 65.2 }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(rows));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], rows);
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

  it('should transform an in-memory array of rows directly (no stream round-trip)', async () => {
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], baseOptions);
    const rows: Array<OIBusRecord> = [{ id: 1, name: 'sensor1', value: 23.5 }];

    const result = await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], rows);
    assert.deepStrictEqual(result.output, Buffer.from('csv content'));
  });

  it('should leave every column untouched when no fields are configured', async () => {
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], baseOptions);
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.strictEqual(mockUtils.convertDateTime.mock.calls.length, 0);
    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], rows);
  });

  it('should leave columns not covered by a field configuration untouched', async () => {
    const options = {
      ...baseOptions,
      fields: [{ fieldName: 'id', columnName: null, dataType: 'number', fieldProcess: null, datetimeSettings: null }]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [
      { timestamp: '2024-01-01T00:00:00Z', value: 42, id: 1 }
    ]);
  });

  it('should re-render a configured datetime field via convertDateTime', async () => {
    mockUtils.convertDateTime = mock.fn(() => '2024-01-01 00:00:00');

    const options = {
      ...baseOptions,
      fields: [
        {
          fieldName: 'timestamp',
          columnName: null,
          dataType: 'datetime',
          fieldProcess: null,
          datetimeSettings: {
            inputType: 'iso-string',
            inputTimezone: 'UTC',
            inputFormat: null,
            inputLocale: null,
            outputType: 'string',
            outputTimezone: 'Europe/Paris',
            outputFormat: 'yyyy-MM-dd HH:mm:ss',
            outputLocale: null
          }
        }
      ]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.strictEqual(mockUtils.convertDateTime.mock.calls.length, 1);
    assert.deepStrictEqual(mockUtils.convertDateTime.mock.calls[0].arguments, [
      '2024-01-01T00:00:00Z',
      { type: 'iso-string', timezone: 'UTC', format: null, locale: null },
      { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss', locale: null }
    ]);
    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [
      { id: 1, value: 42, timestamp: '2024-01-01 00:00:00' }
    ]);
    // The original row array must not be mutated in place.
    assert.strictEqual(rows[0].timestamp, '2024-01-01T00:00:00Z');
  });

  it('should rename a field to its configured column name', async () => {
    const options = {
      ...baseOptions,
      fields: [{ fieldName: 'id', columnName: 'identifier', dataType: 'number', fieldProcess: null, datetimeSettings: null }]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ id: 1, value: 42 }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [{ value: 42, identifier: 1 }]);
  });

  it('should cast a field to string/number/boolean/object per its configured data type', async () => {
    const options = {
      ...baseOptions,
      fields: [
        { fieldName: 'a', columnName: null, dataType: 'string', fieldProcess: null, datetimeSettings: null },
        { fieldName: 'b', columnName: null, dataType: 'number', fieldProcess: null, datetimeSettings: null },
        { fieldName: 'c', columnName: null, dataType: 'boolean', fieldProcess: null, datetimeSettings: null },
        { fieldName: 'd', columnName: null, dataType: 'object', fieldProcess: null, datetimeSettings: null }
      ]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ a: 42, b: '3.14', c: true, d: '{"nested":true}' }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [
      { a: '42', b: 3.14, c: 'true', d: '"{\\"nested\\":true}"' }
    ]);
  });

  it('should use the configured null value when a field is null or undefined', async () => {
    const options = {
      ...baseOptions,
      nullValue: 'N/A',
      fields: [{ fieldName: 'timestamp', columnName: null, dataType: 'string', fieldProcess: null, datetimeSettings: null }]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: null }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.strictEqual(mockUtils.convertDateTime.mock.calls.length, 0);
    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [{ id: 1, timestamp: 'N/A' }]);
  });

  it('should apply the field process expression after casting', async () => {
    const options = {
      ...baseOptions,
      fields: [{ fieldName: 'name', columnName: null, dataType: 'string', fieldProcess: 'value.toUpperCase()', datetimeSettings: null }]
    };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);
    const rows: Array<OIBusRecord> = [{ name: 'sensor1' }];

    await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual((mockPapaparse.unparse.mock.calls[0].arguments as [unknown])[0], [{ name: 'SENSOR1' }]);
  });

  it('should pass quoteChar, escapeChar, newline and header to csv.unparse', async () => {
    mockUtils.convertQuoteChar = mock.fn(() => "'");
    mockUtils.convertEscapeChar = mock.fn(() => '\\');
    mockUtils.convertNewline = mock.fn(() => '\r\n');

    const options = { ...baseOptions, header: false, newline: 'CRLF', quoteChar: 'SINGLE_QUOTE', escapeChar: 'BACKSLASH' };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

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

    const options = { ...baseOptions, quoteChar: 'NONE' };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    const callOpts = (mockPapaparse.unparse.mock.calls[0].arguments as [unknown, Record<string, unknown>])[1];
    assert.strictEqual(callOpts.quotes, false);
  });

  it('should prepend UTF-8 BOM when encoding is UTF_8_BOM', async () => {
    const options = { ...baseOptions, encoding: 'UTF_8_BOM' };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    const result = await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    const buf = result.output as Buffer;
    assert.strictEqual(buf[0], 0xef);
    assert.strictEqual(buf[1], 0xbb);
    assert.strictEqual(buf[2], 0xbf);
    assert.strictEqual(buf.subarray(3).toString('utf-8'), 'csv content');
  });

  it('should encode as Latin-1 Buffer when encoding is LATIN_1', async () => {
    const options = { ...baseOptions, encoding: 'LATIN_1' };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    const result = await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    assert.strictEqual((result.output as Buffer).toString('latin1'), 'csv content');
  });

  it('should encode as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE', async () => {
    const options = { ...baseOptions, encoding: 'UTF_16_LE' };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    const result = await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    const buf = result.output as Buffer;
    assert.strictEqual(buf[0], 0xff);
    assert.strictEqual(buf[1], 0xfe);
    assert.strictEqual(buf.subarray(2).toString('utf16le'), 'csv content');
  });

  it('should gzip the output and append .gz to the filename when compression is enabled', async () => {
    const options = { ...baseOptions, compression: true };
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], options);

    const result = await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    assert.ok(result.metadata.contentFile.endsWith('.gz'));
    assert.strictEqual(zlib.gunzipSync(result.output).toString('utf-8'), 'csv content');
  });

  it('should not gzip the output when compression is disabled', async () => {
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], baseOptions);

    const result = await transformer.transformInMemory([{ id: 1 }], { source: 'test' }, null);

    assert.ok(!result.metadata.contentFile.endsWith('.gz'));
    assert.strictEqual(result.output.toString('utf-8'), 'csv content');
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(recordListToCsvManifest.settings !== undefined);
    assert.strictEqual(recordListToCsvManifest.settings.type, 'object');
    assert.strictEqual(recordListToCsvManifest.settings.key, 'options');
    assert.strictEqual(recordListToCsvManifest.settings.attributes[0].key, 'filename');
    assert.strictEqual(recordListToCsvManifest.inputType, 'record-list');
    assert.strictEqual(recordListToCsvManifest.outputType, 'any');
  });
});
