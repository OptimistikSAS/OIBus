import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it, mock } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type CSVToRecordListTransformerType from './csv-to-record-list-transformer';
import csvToRecordListManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

// Same object for the whole file: the transformer keeps a reference to it, only `parse` is replaced per test
const createParseMock = () => mock.fn((_content: string, _config?: { header: boolean; delimiter: string }): unknown => undefined);
const papaparseExports = { parse: createParseMock() };
let CSVToRecordListTransformer: typeof CSVToRecordListTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'fixed-random-id' });
  mockModule(nodeRequire, 'papaparse', papaparseExports);
  const mod = reloadModule<{ default: typeof CSVToRecordListTransformerType }>(nodeRequire, './csv-to-record-list-transformer');
  CSVToRecordListTransformer = mod.default;
});

describe('CSVToRecordListTransformer', () => {
  let logger: PinoLogger;

  const headerOptions = {
    regex: '.*\\.csv',
    filename: 'header-output',
    delimiter: 'SEMI_COLON',
    hasHeader: true,
    pointIdColumn: 'SensorID',
    timestampColumn: 'Time',
    valueColumn: 'Reading',
    timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
  };

  const indexOptions = {
    regex: '.*\\.csv',
    filename: 'index-output',
    delimiter: 'COMMA',
    hasHeader: false,
    pointIdColumn: '0',
    timestampColumn: '1',
    valueColumn: '2',
    timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
  };

  /** Transforms a CSV file that papaparse parses into `parseResult` */
  const transformParsed = (options: object, parseResult: { errors: Array<object>; data: Array<unknown> }) => {
    papaparseExports.parse.mock.mockImplementation(() => parseResult);
    const transformer = new CSVToRecordListTransformer(logger, testData.transformers.list[0], options);
    return transformer.transform(Readable.from('raw-csv-content'), { source: 'test' }, 'data.csv');
  };

  beforeEach(() => {
    logger = new PinoLogger();
    papaparseExports.parse = createParseMock();
  });

  it('should transform valid CSV with headers', async () => {
    const result = await transformParsed(headerOptions, {
      errors: [],
      data: [
        // ISO strings carry their offset: the timezone setting only applies to the 'string' type
        { SensorID: 'S1', Time: '2023-01-01T00:00:00Z', Reading: 10 },
        { SensorID: 'S2', Time: '2023-01-02T02:00:00+02:00', Reading: 20 }
      ]
    });
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(papaparseExports.parse.mock.calls.length, 1);
    const parseOptions0 = papaparseExports.parse.mock.calls[0].arguments[1]!;
    assert.strictEqual(parseOptions0.header, true);
    assert.strictEqual(parseOptions0.delimiter, ';');
    assert.deepStrictEqual(output, [
      { pointId: 'S1', value: 10, timestamp: '2023-01-01T00:00:00.000Z' },
      { pointId: 'S2', value: 20, timestamp: '2023-01-02T00:00:00.000Z' }
    ]);
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'fixed-random-id.json',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'record-list'
    });
  });

  it('should transform valid CSV without headers (using indices)', async () => {
    const result = await transformParsed(indexOptions, {
      errors: [],
      data: [
        ['S1', '2023-01-01T00:00:00Z', 10],
        ['S2', '2023-01-02T02:00:00+02:00', 20]
      ]
    });
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(papaparseExports.parse.mock.calls.length, 1);
    const parseOptions1 = papaparseExports.parse.mock.calls[0].arguments[1]!;
    assert.strictEqual(parseOptions1.header, false);
    assert.strictEqual(parseOptions1.delimiter, ',');
    assert.deepStrictEqual(output, [
      { pointId: 'S1', value: 10, timestamp: '2023-01-01T00:00:00.000Z' },
      { pointId: 'S2', value: 20, timestamp: '2023-01-02T00:00:00.000Z' }
    ]);
  });

  it('should convert the timestamps with the timestamp settings', async () => {
    const result = await transformParsed(
      { ...headerOptions, timestampSettings: { type: 'string', timezone: 'Europe/Paris', format: 'dd/MM/yyyy HH:mm:ss', locale: 'en' } },
      {
        errors: [],
        data: [
          { SensorID: 'S1', Time: '01/01/2023 10:30:00', Reading: 10 },
          { SensorID: 'S2', Time: '01/07/2023 10:30:00', Reading: 20 }
        ]
      }
    );
    const output = JSON.parse(result.output.toString());

    // Paris local times, in UTC: winter (UTC+1) then summer (UTC+2) time
    assert.deepStrictEqual(
      output.map((timeValue: { timestamp: string }) => timeValue.timestamp),
      ['2023-01-01T09:30:00.000Z', '2023-07-01T08:30:00.000Z']
    );
  });

  it('should skip rows with missing or invalid required fields', async () => {
    const result = await transformParsed(headerOptions, {
      errors: [],
      data: [
        { SensorID: 'Valid', Time: '2023', Reading: 1 },
        { SensorID: null, Time: '2023', Reading: 2 },
        { SensorID: 'NoTS', Time: null, Reading: 3 },
        { SensorID: 'NoVal', Time: '2023', Reading: null },
        { SensorID: 'ValidZero', Time: '2023', Reading: 0 }
      ]
    });
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'Valid');
    assert.strictEqual(output[1].pointId, 'ValidZero');
  });

  it('should handle configuration errors for Index Mode (NaN indices)', async () => {
    const badConfig = { ...indexOptions, pointIdColumn: 'NotANumber' };
    const result = await transformParsed(badConfig, {
      errors: [],
      data: [['S1', '2023', 10]]
    });
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(output.length, 0);
  });

  it('should log warning if PapaParse reports errors', async () => {
    await transformParsed(headerOptions, {
      errors: [{ message: 'Unclosed quote', row: 0 }],
      data: []
    });

    assert.strictEqual(logger.warn.mock.calls.length, 1);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '[CSVToRecordList] Encountered 1 errors while parsing "data.csv". First error: Unclosed quote'
    ]);
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(csvToRecordListManifest.settings !== undefined);
    assert.strictEqual(csvToRecordListManifest.settings.key, 'options');
    assert.strictEqual(csvToRecordListManifest.settings.attributes[0].key, 'delimiter');
  });
});
