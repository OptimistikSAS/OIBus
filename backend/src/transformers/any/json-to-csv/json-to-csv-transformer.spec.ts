import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule, assertContains } from '../../../tests/utils/test-utils';
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

  it('should resolve nested JSON-stringified field via recursive path traversal', async () => {
    const options = {
      regex: '.*\\.json',
      filename: 'nested-test.csv',
      delimiter: 'SEMI_COLON',
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].metadata.nestedField', columnName: 'Nested', dataType: 'string' }]
    };
    const inputData = [{ metadata: JSON.stringify({ nestedField: 'value' }) }];
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'input.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    await promise;

    assert.ok(mockPapaparse.unparse.mock.calls.length > 0);
    assert.deepStrictEqual(mockPapaparse.unparse.mock.calls[0].arguments[0], [{ Nested: 'value' }]);
  });

  it('should split multiple metrics embedded in a single JSON-stringified MQTT message into separate CSV rows', async () => {
    const options = {
      regex: '.*\\.json',
      filename: 'mqtt-test.csv',
      delimiter: 'SEMI_COLON',
      rowIteratorPath: '$[*].message.metrics[*]',
      fields: [
        { jsonPath: '$[*].message.metrics[*].name', columnName: 'Name', dataType: 'string' },
        { jsonPath: '$[*].message.metrics[*].value', columnName: 'Value', dataType: 'number' }
      ]
    };
    // A single MQTT message can carry several metrics in its (JSON-stringified) payload.
    const inputData = [
      {
        message: JSON.stringify({
          metrics: [
            { name: 'TAG.A', value: 1.1 },
            { name: 'TAG.B', value: 2.2 }
          ]
        })
      },
      { message: JSON.stringify({ metrics: [{ name: 'TAG.C', value: 3.3 }] }) }
    ];
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'input.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    await promise;

    assert.ok(mockPapaparse.unparse.mock.calls.length > 0);
    assert.deepStrictEqual(mockPapaparse.unparse.mock.calls[0].arguments[0], [
      { Name: 'TAG.A', Value: 1.1 },
      { Name: 'TAG.B', Value: 2.2 },
      { Name: 'TAG.C', Value: 3.3 }
    ]);
  });

  describe('fieldProcess', () => {
    it('should apply fieldProcess expression to the typed value before writing to CSV', async () => {
      mockPapaparse.unparse = mock.fn(() => 'csv result');

      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [
          { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: 'value.toUpperCase()' },
          { jsonPath: '$[*].score', columnName: 'Score', dataType: 'number', fieldProcess: 'Math.round(value * 100) / 100' },
          { jsonPath: '$[*].tag', columnName: 'Tag', dataType: 'string', fieldProcess: null }
        ]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      mockStream.push(JSON.stringify([{ name: 'hello', score: 3.14159, tag: 'keep-me' }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
      const callData = (mockPapaparse.unparse.mock.calls[0].arguments as [Array<Record<string, unknown>>, unknown])[0];
      assert.deepStrictEqual(callData, [{ Name: 'HELLO', Score: 3.14, Tag: 'keep-me' }]);
      assertContains(mockPapaparse.unparse.mock.calls[0].arguments[1] as Record<string, unknown>, { delimiter: ';' });
    });

    it('should skip fieldProcess when it is null or empty', async () => {
      mockPapaparse.unparse = mock.fn(() => 'csv result');

      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [
          { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: '' },
          { jsonPath: '$[*].id', columnName: 'ID', dataType: 'number', fieldProcess: '   ' }
        ]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      mockStream.push(JSON.stringify([{ name: 'original', id: 42 }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      assert.strictEqual(mockPapaparse.unparse.mock.calls.length, 1);
      const callData = (mockPapaparse.unparse.mock.calls[0].arguments as [Array<Record<string, unknown>>, unknown])[0];
      assert.deepStrictEqual(callData, [{ Name: 'original', ID: 42 }]);
      assertContains(mockPapaparse.unparse.mock.calls[0].arguments[1] as Record<string, unknown>, { delimiter: ';' });
    });

    it('should throw a descriptive error when fieldProcess expression is invalid', async () => {
      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: 'value.nonExistentMethod()' }]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      const rejectPromise = assert.rejects(promise, /Field process evaluation failed/);
      mockStream.push(JSON.stringify([{ name: 'hello' }]));
      mockStream.push(null);
      await flushPromises();
      await rejectPromise;
    });

    it('should expose fieldProcess attribute in the manifest', () => {
      const fieldItem = jsonToCsvManifest.settings.attributes.find((a: { key: string }) => a.key === 'fields');
      assert.ok(fieldItem !== undefined);
      assert.strictEqual(fieldItem.type, 'array');
      if (fieldItem.type === 'array') {
        const fieldProcessAttr = fieldItem.rootAttribute.attributes.find((a: { key: string }) => a.key === 'fieldProcess');
        assert.ok(fieldProcessAttr !== undefined);
        assert.strictEqual(fieldProcessAttr.type, 'string');
        assert.deepStrictEqual(fieldProcessAttr.validators, []);
      }
    });
  });
});
