import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';

import type { CacheMetadataSource } from '../../../model/engine.model';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import timeValuesToCsvManifest from './manifest';
import type OIBusTimeValuesToCsvTransformerType from './oibus-time-values-to-csv-transformer';

const nodeRequire = createRequire(import.meta.url);

const createUnparseMock = () => mock.fn((_data: unknown, _config?: Record<string, unknown>) => 'csv content');
// Same object for the whole file: the transformer keeps a reference to it, only `unparse` is replaced per test
const papaparseExports = { unparse: createUnparseMock() };
let OIBusTimeValuesToCsvTransformer: typeof OIBusTimeValuesToCsvTransformerType;

before(() => {
  mockModule(nodeRequire, 'papaparse', papaparseExports);
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToCsvTransformerType }>(nodeRequire, './oibus-time-values-to-csv-transformer');
  OIBusTimeValuesToCsvTransformer = mod.default;
});

describe('OIBusTimeValuesToCsvTransformer', () => {
  let logger: PinoLogger;

  const baseOptions = {
    filename: 'output.csv',
    encoding: 'UTF_8',
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
  const timeValue: OIBusTimeValue = { pointId: 'ref-1', timestamp: '2024-01-01T00:00:00Z', data: { value: '42' } };

  const transformTimeValues = (options: object, timeValues: Array<OIBusTimeValue>, source: CacheMetadataSource = { source: 'test' }) =>
    new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], options).transform(
      Readable.from(JSON.stringify(timeValues)),
      source,
      null
    );
  /** The rows given to csv.unparse, and its options */
  const unparsedRows = () => papaparseExports.unparse.mock.calls[0].arguments[0];
  const unparseOptions = () => papaparseExports.unparse.mock.calls[0].arguments[1]!;

  beforeEach(() => {
    logger = new PinoLogger();
    papaparseExports.unparse = createUnparseMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      ...baseOptions,
      filename: '@CurrentDate.csv',
      timestampType: 'string',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timezone: 'Europe/Paris'
    };

    const result = await transformTimeValues(options, [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 'value1' } },
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_2, data: { value: 'value2', quality: 'good' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ]);

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

  it('should replace @QueryStartTime and @QueryEndTime with the south history query window', async () => {
    const result = await transformTimeValues({ ...baseOptions, filename: '@QueryStartTime_@QueryEndTime.csv' }, [], {
      source: 'south',
      southId: 'south1',
      southName: 'South 1',
      queryTime: testData.constants.dates.DATE_1,
      queryStartTime: '2023-01-01T00:00:00.000Z',
      queryEndTime: '2023-01-01T01:00:00.000Z',
      items: []
    });

    assert.strictEqual(result.metadata.contentFile, '2023_01_01_00_00_00_000_2023_01_01_01_00_00_000.csv');
  });

  it('should pass quoteChar, escapeChar, newline and header to csv.unparse', async () => {
    await transformTimeValues({ ...baseOptions, header: false, newline: 'CRLF', quoteChar: 'SINGLE_QUOTE', escapeChar: 'BACKSLASH' }, [
      timeValue
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
    await transformTimeValues({ ...baseOptions, quoteChar: 'NONE' }, [timeValue]);

    assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
    assert.strictEqual(unparseOptions().quotes, false);
  });

  const encodingCases = [
    {
      title: 'should prepend UTF-8 BOM when encoding is UTF_8_BOM',
      encoding: 'UTF_8_BOM',
      expected: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('csv content')])
    },
    {
      title: 'should encode as Latin-1 Buffer when encoding is LATIN_1',
      encoding: 'LATIN_1',
      expected: Buffer.from('csv content', 'latin1')
    },
    {
      title: 'should encode as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE',
      encoding: 'UTF_16_LE',
      expected: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('csv content', 'utf16le')])
    }
  ];
  for (const { title, encoding, expected } of encodingCases) {
    it(title, async () => {
      const result = await transformTimeValues({ ...baseOptions, encoding }, [timeValue]);

      assert.deepStrictEqual(result.output, expected);
    });
  }

  it('should parse jsonData from a JSON string when transformInMemory receives non-array data', async () => {
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], baseOptions);

    const result = await transformer.transformInMemory(JSON.stringify([timeValue]), { source: 'test' }, null);

    assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
    assert.deepStrictEqual(unparsedRows(), [{ Ref: 'ref-1', Val: '42', TS: '2024-01-01T00:00:00Z' }]);
    assert.ok(result.output instanceof Buffer);
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(timeValuesToCsvManifest.settings !== undefined);
    assert.strictEqual(timeValuesToCsvManifest.settings.type, 'object');
    assert.strictEqual(timeValuesToCsvManifest.settings.key, 'options');
    assert.strictEqual(timeValuesToCsvManifest.settings.attributes[0].key, 'filename');
  });

  describe('fieldProcess', () => {
    it('should apply pointIdProcess, valueProcess and timestampProcess to their respective columns', async () => {
      const options = {
        ...baseOptions,
        quoteChar: 'NONE',
        timestampType: 'string',
        timestampFormat: 'yyyy-MM-dd HH:mm:ss',
        timezone: 'UTC',
        pointIdProcess: 'value.toUpperCase()',
        valueProcess: 'String(value).replace(".", ",")',
        timestampProcess: 'value.slice(0, 10)'
      };

      await transformTimeValues(options, [{ ...timeValue, data: { value: '3.14' } }]);

      assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
      assert.deepStrictEqual(unparsedRows(), [{ Ref: 'REF-1', Val: '3.14', TS: '2024-01-01 00:00:00' }]);
    });

    it('should leave column values unchanged when process fields are null', async () => {
      const options = { ...baseOptions, quoteChar: 'NONE', pointIdProcess: null, valueProcess: null, timestampProcess: null };

      await transformTimeValues(options, [timeValue]);

      assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
      assert.deepStrictEqual(unparsedRows(), [{ Ref: 'ref-1', Val: '42', TS: '2024-01-01T00:00:00Z' }]);
    });

    it('should throw a descriptive error when a process expression is invalid', async () => {
      const options = { ...baseOptions, quoteChar: 'NONE', pointIdProcess: 'value.boom()', valueProcess: null, timestampProcess: null };

      await assert.rejects(transformTimeValues(options, [timeValue]), /Field process evaluation failed/);
    });

    it('should expose process attributes in the manifest', () => {
      const attrs = timeValuesToCsvManifest.settings.attributes;
      const pointIdAttr = attrs.find((a: { key: string }) => a.key === 'pointIdProcess');
      assert.ok(pointIdAttr !== undefined);
      assert.strictEqual(pointIdAttr.type, 'string');
      assert.deepStrictEqual(pointIdAttr.validators, []);
    });
  });
});
