import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import {flushPromises, mockModule, reloadModule, assertContains} from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type JSONToCSVTransformerType from './json-to-csv-transformer';
import jsonToCsvManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockPapaparse: Record<string, ReturnType<typeof mock.fn>>;
let JSONToCSVTransformer: typeof JSONToCSVTransformerType;

before(() => {
  mockUtils = {
    convertDateTime: mock.fn((value: unknown) => value),
    convertDelimiter: mock.fn(() => ';'),
    injectIndices: mock.fn((path: string, indices: Array<number>) => {
      let pointer = 0;
      return path.replace(/\[\*\]/g, () => `[${indices[pointer++]}]`);
    }),
    sanitizeFilename: mock.fn((name: string) => name),
    stringToBoolean: mock.fn(() => true),
    convertQuoteChar: mock.fn(() => '"'),
    convertEscapeChar: mock.fn(() => '"'),
    convertNewline: mock.fn(() => '')
  };
  mockPapaparse = { unparse: mock.fn(() => 'csv content') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  mockModule(nodeRequire, 'papaparse', mockPapaparse);
  const mod = reloadModule<{ default: typeof JSONToCSVTransformerType }>(nodeRequire, './json-to-csv-transformer');
  JSONToCSVTransformer = mod.default;
});

describe('JSONToCSVTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.convertDateTime = mock.fn((value: unknown) => value);
    mockUtils.convertDelimiter = mock.fn(() => ';');
    mockUtils.injectIndices = mock.fn((path: string, indices: Array<number>) => {
      let pointer = 0;
      return path.replace(/\[\*\]/g, () => `[${indices[pointer++]}]`);
    });
    mockUtils.sanitizeFilename = mock.fn((name: string) => name);
    mockUtils.stringToBoolean = mock.fn(() => true);
    mockUtils.convertQuoteChar = mock.fn(() => '"');
    mockUtils.convertEscapeChar = mock.fn(() => '"');
    mockUtils.convertNewline = mock.fn(() => '');
    mockPapaparse.unparse = mock.fn(() => 'csv content');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata when regex matches', async () => {
    const options = {
      regex: '.*\\.json',
      filename: 'test-output.csv',
      delimiter: 'SEMI_COLON',
      rowIteratorPath: '$[*]',
      fields: [
        { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' },
        { jsonPath: '$[*].id', columnName: 'ID', dataType: 'number' }
      ]
    };
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const inputData = [
      { name: 'Item 1', id: 1 },
      { name: 'Item 2', id: 2 }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'input.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.ok(mockPapaparse.unparse.mock.calls.length > 0);
    assert.deepStrictEqual(mockPapaparse.unparse.mock.calls[0].arguments[0], [
      { Name: 'Item 1', ID: 1 },
      { Name: 'Item 2', ID: 2 }
    ]);
    assertContains(mockPapaparse.unparse.mock.calls[0].arguments[1] as Record<string, unknown>, { delimiter: ';' });

    assert.deepStrictEqual(result, {
      output: Buffer.from('csv content'),
      metadata: {
        contentFile: 'test-output.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any'
      }
    });
  });

  it('should handle complex data types (datetime, boolean, object, array) and missing values', async () => {
    const options = {
      regex: '.*\\.json',
      filename: 'complex-test',
      delimiter: 'SEMI_COLON',
      rowIteratorPath: '$[*]',
      fields: [
        {
          jsonPath: '$[*].createdAt',
          columnName: 'Created At',
          dataType: 'datetime',
          datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
        },
        { jsonPath: '$[*].isActive', columnName: 'Active', dataType: 'boolean' },
        { jsonPath: '$[*].details', columnName: 'Details', dataType: 'object' },
        { jsonPath: '$[*].tags', columnName: 'Tags', dataType: 'array' },
        { jsonPath: '$[*].ghostField', columnName: 'Ghost', dataType: 'string' }
      ]
    };
    const inputData = [
      {
        createdAt: '2023-10-27T10:00:00Z',
        isActive: 'yes',
        details: { user: 'admin', rights: [1, 2] },
        tags: ['urgent', 'work']
      }
    ];
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    mockPapaparse.unparse = mock.fn(() => 'csv result');
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    await promise;

    assert.ok(mockPapaparse.unparse.mock.calls.length > 0);
    assert.deepStrictEqual(mockPapaparse.unparse.mock.calls[0].arguments[0], [
      {
        'Created At': '2023-10-27T10:00:00Z',
        Active: 'true',
        Details: '{"user":"admin","rights":[1,2]}',
        Tags: '["urgent","work"]',
        Ghost: ''
      }
    ]);
    assertContains(mockPapaparse.unparse.mock.calls[0].arguments[1] as Record<string, unknown>, { delimiter: ';' });
  });

  it('should return correct manifest settings', () => {
    assert.strictEqual(jsonToCsvManifest.settings.key, 'options');
    assert.strictEqual(jsonToCsvManifest.settings.attributes[0].key, 'filename');
  });
});
