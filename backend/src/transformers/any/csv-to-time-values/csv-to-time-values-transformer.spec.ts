import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type CSVToTimeValuesTransformerType from './csv-to-time-values-transformer';
import csvToTimeValuesManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockPapaparse: Record<string, ReturnType<typeof mock.fn>>;
let CSVToTimeValuesTransformer: typeof CSVToTimeValuesTransformerType;

before(() => {
  mockUtils = {
    convertDateTimeToInstant: mock.fn(() => 1698400000000),
    convertDelimiter: mock.fn((delim: string) => (delim === 'SEMI_COLON' ? ';' : ',')),
    generateRandomId: mock.fn(() => 'fixed-random-id')
  };
  mockPapaparse = { parse: mock.fn() };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  mockModule(nodeRequire, 'papaparse', mockPapaparse);
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

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.convertDateTimeToInstant = mock.fn(() => 1698400000000);
    mockUtils.convertDelimiter = mock.fn((delim: string) => (delim === 'SEMI_COLON' ? ';' : ','));
    mockUtils.generateRandomId = mock.fn(() => 'fixed-random-id');
    mockPapaparse.parse = mock.fn();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform valid CSV with headers', async () => {
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], headerOptions);
    mockPapaparse.parse = mock.fn(() => ({
      errors: [],
      data: [
        { SensorID: 'S1', Time: '2023-01-01', Reading: 10 },
        { SensorID: 'S2', Time: '2023-01-02', Reading: 20 }
      ]
    }));
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('raw-csv-content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output.toString());

    assert.ok(mockPapaparse.parse.mock.calls.length > 0);
    const parseOptions0 = mockPapaparse.parse.mock.calls[0].arguments[1] as { header: boolean; delimiter: string };
    assert.strictEqual(parseOptions0.header, true);
    assert.strictEqual(parseOptions0.delimiter, ';');
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'S1');
    assert.strictEqual(output[1].data.value, 20);
    assert.strictEqual(result.metadata.contentFile, 'fixed-random-id.json');
  });

  it('should transform valid CSV without headers (using indices)', async () => {
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], indexOptions);
    mockPapaparse.parse = mock.fn(() => ({
      errors: [],
      data: [
        ['S1', '2023-01-01', 10],
        ['S2', '2023-01-02', 20]
      ]
    }));
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output.toString());

    assert.ok(mockPapaparse.parse.mock.calls.length > 0);
    const parseOptions1 = mockPapaparse.parse.mock.calls[0].arguments[1] as { header: boolean; delimiter: string };
    assert.strictEqual(parseOptions1.header, false);
    assert.strictEqual(parseOptions1.delimiter, ',');
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'S1');
    assert.strictEqual(output[1].pointId, 'S2');
  });

  it('should skip rows with missing or invalid required fields', async () => {
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], headerOptions);
    mockPapaparse.parse = mock.fn(() => ({
      errors: [],
      data: [
        { SensorID: 'Valid', Time: '2023', Reading: 1 },
        { SensorID: null, Time: '2023', Reading: 2 },
        { SensorID: 'NoTS', Time: null, Reading: 3 },
        { SensorID: 'NoVal', Time: '2023', Reading: null },
        { SensorID: 'ValidZero', Time: '2023', Reading: 0 }
      ]
    }));
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].pointId, 'Valid');
    assert.strictEqual(output[1].pointId, 'ValidZero');
  });

  it('should handle configuration errors for Index Mode (NaN indices)', async () => {
    const badConfig = { ...indexOptions, pointIdColumn: 'NotANumber' };
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], badConfig);
    mockPapaparse.parse = mock.fn(() => ({
      errors: [],
      data: [['S1', '2023', 10]]
    }));
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output.toString());

    assert.strictEqual(output.length, 0);
  });

  it('should log warning if PapaParse reports errors', async () => {
    const transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], headerOptions);
    mockPapaparse.parse = mock.fn(() => ({
      errors: [{ message: 'Unclosed quote', row: 0 }],
      data: []
    }));
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('bad-csv');
    mockStream.push(null);
    await flushPromises();
    await promise;

    assert.ok(logger.warn.mock.calls.length > 0);
    assert.ok((logger.warn.mock.calls[0].arguments[0] as string).includes('Encountered 1 errors while parsing'));
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(csvToTimeValuesManifest.settings !== undefined);
    assert.strictEqual(csvToTimeValuesManifest.settings.key, 'options');
    assert.strictEqual(csvToTimeValuesManifest.settings.attributes[0].key, 'delimiter');
  });
});
