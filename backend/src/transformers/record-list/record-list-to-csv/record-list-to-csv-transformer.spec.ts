import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { OIBusRecord } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import recordListToCsvManifest from './manifest';
import type RecordListToCsvTransformerType from './record-list-to-csv-transformer';

const nodeRequire = createRequire(import.meta.url);

const createUnparseMock = () => mock.fn((_data: unknown, _config?: Record<string, unknown>) => 'csv content');
// Same objects for the whole file: the transformer keeps a reference to them, their mocks are replaced per test
const papaparseExports = { unparse: createUnparseMock() };
let utils: typeof Utils;
let utilsExports: typeof Utils;
let RecordListToCsvTransformer: typeof RecordListToCsvTransformerType;

before(() => {
  utils = nodeRequire('../../../service/utils') as typeof Utils;
  utilsExports = { ...utils };
  mockModule(nodeRequire, '../../../service/utils', utilsExports);
  mockModule(nodeRequire, 'papaparse', papaparseExports);
  const mod = reloadModule<{ default: typeof RecordListToCsvTransformerType }>(nodeRequire, './record-list-to-csv-transformer');
  RecordListToCsvTransformer = mod.default;
});

describe('RecordListToCsvTransformer', () => {
  let logger: PinoLogger;
  let convertDateTime: ReturnType<typeof mock.fn<typeof Utils.convertDateTime>>;

  beforeEach(() => {
    logger = new PinoLogger();
    convertDateTime = mock.fn(utils.convertDateTime);
    Object.assign(utilsExports, { convertDateTime });
    papaparseExports.unparse = createUnparseMock();
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
    keepOtherFields: true,
    fields: null
  };

  const field = (fieldName: string, dataType: string, extra: object = {}) => ({
    fieldName,
    columnName: null,
    dataType,
    fieldProcess: null,
    datetimeSettings: null,
    ...extra
  });
  const transformRows = (options: object, rows: Array<OIBusRecord>) =>
    new RecordListToCsvTransformer(logger, testData.transformers.list[0], options).transformInMemory(rows, { source: 'test' }, null);
  /** The rows given to csv.unparse, and its options */
  const unparsedRows = () => papaparseExports.unparse.mock.calls[0].arguments[0];
  const unparseOptions = () => papaparseExports.unparse.mock.calls[0].arguments[1]!;

  it('should transform record-list data from a stream and return metadata', async () => {
    const transformer = new RecordListToCsvTransformer(logger, testData.transformers.list[0], baseOptions);
    const rows: Array<OIBusRecord> = [
      { id: 1, name: 'sensor1', value: 23.5 },
      { id: 2, name: 'sensor2', value: 65.2 }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(rows)), { source: 'test' }, null);

    assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
    assert.deepStrictEqual(unparsedRows(), rows);
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
    const rows: Array<OIBusRecord> = [{ id: 1, name: 'sensor1', value: 23.5 }];

    const result = await transformRows(baseOptions, rows);

    assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
    assert.deepStrictEqual(unparsedRows(), rows);
    assert.deepStrictEqual(result.output, Buffer.from('csv content'));
  });

  it('should leave every column untouched when no fields are configured', async () => {
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformRows(baseOptions, rows);

    assert.strictEqual(convertDateTime.mock.calls.length, 0);
    assert.deepStrictEqual(unparsedRows(), rows);
  });

  it('should leave columns not covered by a field configuration untouched', async () => {
    const options = { ...baseOptions, fields: [field('id', 'number')] };
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformRows(options, rows);

    assert.deepStrictEqual(unparsedRows(), [{ timestamp: '2024-01-01T00:00:00Z', value: 42, id: 1 }]);
  });

  it('should re-render a configured datetime field via convertDateTime', async () => {
    const options = {
      ...baseOptions,
      fields: [
        field('timestamp', 'datetime', {
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
        })
      ]
    };
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: '2024-01-01T00:00:00Z', value: 42 }];

    await transformRows(options, rows);

    assert.strictEqual(convertDateTime.mock.calls.length, 1);
    assert.deepStrictEqual(convertDateTime.mock.calls[0].arguments, [
      '2024-01-01T00:00:00Z',
      { type: 'iso-string', timezone: 'UTC', format: null, locale: null },
      { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss', locale: null }
    ]);
    assert.deepStrictEqual(unparsedRows(), [{ id: 1, value: 42, timestamp: '2024-01-01 01:00:00' }]);
    // The original row array must not be mutated in place.
    assert.strictEqual(rows[0].timestamp, '2024-01-01T00:00:00Z');
  });

  it('should rename a field to its configured column name', async () => {
    const options = { ...baseOptions, fields: [field('id', 'number', { columnName: 'identifier' })] };
    const rows: Array<OIBusRecord> = [{ id: 1, value: 42 }];

    await transformRows(options, rows);

    assert.deepStrictEqual(unparsedRows(), [{ value: 42, identifier: 1 }]);
  });

  it('should only write the configured fields, in their order, when the other fields are not kept', async () => {
    const options = {
      ...baseOptions,
      keepOtherFields: false,
      fields: [field('pointId', 'string', { columnName: 'Reference' }), field('value', 'number')]
    };
    const rows: Array<OIBusRecord> = [{ value: 42, quality: 'Good', pointId: 'p1' }];

    await transformRows(options, rows);

    assert.deepStrictEqual(unparsedRows(), [{ Reference: 'p1', value: 42 }]);
  });

  it('should cast a field to string/number/boolean/object per its configured data type', async () => {
    const options = { ...baseOptions, fields: [field('a', 'string'), field('b', 'number'), field('c', 'boolean'), field('d', 'object')] };
    const rows: Array<OIBusRecord> = [{ a: 42, b: '3.14', c: true, d: '{"nested":true}' }];

    await transformRows(options, rows);

    assert.deepStrictEqual(unparsedRows(), [{ a: '42', b: 3.14, c: 'true', d: '"{\\"nested\\":true}"' }]);
  });

  it('should use the configured null value when a field is null or undefined', async () => {
    const options = { ...baseOptions, nullValue: 'N/A', fields: [field('timestamp', 'string')] };
    const rows: Array<OIBusRecord> = [{ id: 1, timestamp: null }];

    await transformRows(options, rows);

    assert.strictEqual(convertDateTime.mock.calls.length, 0);
    assert.deepStrictEqual(unparsedRows(), [{ id: 1, timestamp: 'N/A' }]);
  });

  it('should apply the field process expression after casting', async () => {
    const options = { ...baseOptions, fields: [field('name', 'string', { fieldProcess: 'value.toUpperCase()' })] };
    const rows: Array<OIBusRecord> = [{ name: 'sensor1' }];

    await transformRows(options, rows);

    assert.deepStrictEqual(unparsedRows(), [{ name: 'SENSOR1' }]);
  });

  it('should pass quoteChar, escapeChar, newline and header to csv.unparse', async () => {
    await transformRows({ ...baseOptions, header: false, newline: 'CRLF', quoteChar: 'SINGLE_QUOTE', escapeChar: 'BACKSLASH' }, [
      { id: 1 }
    ]);

    assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
    const callOpts = unparseOptions();
    assert.strictEqual(callOpts.quoteChar, "'");
    assert.strictEqual(callOpts.escapeChar, '\\');
    assert.strictEqual(callOpts.newline, '\r\n');
    assert.strictEqual(callOpts.header, false);
    assert.strictEqual(callOpts.quotes, true);
  });

  it('should disable quoting when quoteChar is NONE', async () => {
    await transformRows({ ...baseOptions, quoteChar: 'NONE' }, [{ id: 1 }]);

    assert.strictEqual(unparseOptions().quotes, false);
  });

  it('should prepend UTF-8 BOM when encoding is UTF_8_BOM', async () => {
    const result = await transformRows({ ...baseOptions, encoding: 'UTF_8_BOM' }, [{ id: 1 }]);

    const buf = result.output;
    assert.strictEqual(buf[0], 0xef);
    assert.strictEqual(buf[1], 0xbb);
    assert.strictEqual(buf[2], 0xbf);
    assert.strictEqual(buf.subarray(3).toString('utf-8'), 'csv content');
  });

  it('should encode as Latin-1 Buffer when encoding is LATIN_1', async () => {
    const result = await transformRows({ ...baseOptions, encoding: 'LATIN_1' }, [{ id: 1 }]);

    assert.strictEqual(result.output.toString('latin1'), 'csv content');
  });

  it('should encode as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE', async () => {
    const result = await transformRows({ ...baseOptions, encoding: 'UTF_16_LE' }, [{ id: 1 }]);

    const buf = result.output;
    assert.strictEqual(buf[0], 0xff);
    assert.strictEqual(buf[1], 0xfe);
    assert.strictEqual(buf.subarray(2).toString('utf16le'), 'csv content');
  });

  it('should gzip the output and append .gz to the filename when compression is enabled', async () => {
    const result = await transformRows({ ...baseOptions, compression: true }, [{ id: 1 }]);

    assert.ok(result.metadata.contentFile.endsWith('.gz'));
    assert.strictEqual(zlib.gunzipSync(result.output).toString('utf-8'), 'csv content');
  });

  it('should not gzip the output when compression is disabled', async () => {
    const result = await transformRows(baseOptions, [{ id: 1 }]);

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
