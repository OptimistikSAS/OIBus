import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule, asLogger } from '../../../tests/utils/test-utils';
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
    const transformer = new OIBusTimeValuesToCsvTransformer(
      asLogger(logger),
      testData.transformers.list[0],
      options
    );
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

  it('should correctly expose the manifest settings', () => {
    assert.ok(timeValuesToCsvManifest.settings !== undefined);
    assert.strictEqual(timeValuesToCsvManifest.settings.type, 'object');
    assert.strictEqual(timeValuesToCsvManifest.settings.key, 'options');
    assert.strictEqual(timeValuesToCsvManifest.settings.attributes[0].key, 'filename');
  });
});
