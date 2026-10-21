import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it, mock } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type CSVToTimeValuesTransformerType from './csv-to-time-values-transformer';
import csvToTimeValuesManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

// Same object for the whole file: the transformer keeps a reference to it, only `parse` is replaced per test
const createParseMock = () => mock.fn((_content: string, _config?: { header: boolean; delimiter: string }): unknown => undefined);
const papaparseExports = { parse: createParseMock() };
let CSVToTimeValuesTransformer: typeof CSVToTimeValuesTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'fixed-random-id' });
  mockModule(nodeRequire, 'papaparse', papaparseExports);
  const mod = reloadModule<{ default: typeof CSVToTimeValuesTransformerType }>(nodeRequire, './csv-to-time-values-transformer');
  CSVToTimeValuesTransformer = mod.default;
});

describe('CSVToTimeValuesTransformer', () => {
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
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], options);
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
        { SensorID: 'S1', Time: '2023-01-01', Reading: 10 },
        { SensorID: 'S2', Time: '2023-01-02', Reading: 20 }
      ]
    });
    const output = JSON.parse(result.output.toString());

    assert.ok(papaparseExports.parse.mock.calls.length > 0);
    const parseOptions0 = papaparseExports.parse.mock.calls[0].arguments[1]!;
    assert.strictEqual(parseOptions0.header, true);
    assert.strictEqual(parseOptions0.delimiter, ';');
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'S1');
    assert.strictEqual(output[1].data.value, 20);
    assert.strictEqual(result.metadata.contentFile, 'fixed-random-id.json');
  });

  it('should transform valid CSV without headers (using indices)', async () => {
    const result = await transformParsed(indexOptions, {
      errors: [],
      data: [
        ['S1', '2023-01-01', 10],
        ['S2', '2023-01-02', 20]
      ]
    });
    const output = JSON.parse(result.output.toString());

    assert.ok(papaparseExports.parse.mock.calls.length > 0);
    const parseOptions1 = papaparseExports.parse.mock.calls[0].arguments[1]!;
    assert.strictEqual(parseOptions1.header, false);
    assert.strictEqual(parseOptions1.delimiter, ',');
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'S1');
    assert.strictEqual(output[1].pointId, 'S2');
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

    assert.ok(logger.warn.mock.calls.length > 0);
    assert.ok((logger.warn.mock.calls[0].arguments[0] as string).includes('Encountered 1 errors while parsing'));
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(csvToTimeValuesManifest.settings !== undefined);
    assert.strictEqual(csvToTimeValuesManifest.settings.key, 'options');
    assert.strictEqual(csvToTimeValuesManifest.settings.attributes[0].key, 'delimiter');
  });
});
