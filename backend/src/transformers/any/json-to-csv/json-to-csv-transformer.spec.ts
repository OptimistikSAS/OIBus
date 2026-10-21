import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { CacheMetadataSource } from '../../../model/engine.model';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { assertContains, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type JSONToCSVTransformerType from './json-to-csv-transformer';
import jsonToCsvManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

const createUnparseMock = () => mock.fn((_data: unknown, _config?: Record<string, unknown>) => 'csv content');
// Same object for the whole file: the transformer keeps a reference to it, only `unparse` is replaced per test
const papaparseExports = { unparse: createUnparseMock() };
let JSONToCSVTransformer: typeof JSONToCSVTransformerType;

before(() => {
  mockModule(nodeRequire, 'papaparse', papaparseExports);
  const mod = reloadModule<{ default: typeof JSONToCSVTransformerType }>(nodeRequire, './json-to-csv-transformer');
  JSONToCSVTransformer = mod.default;
});

describe('JSONToCSVTransformer', () => {
  let logger: PinoLogger;

  const baseOptions = { regex: '.*\\.json', filename: 'output.csv', delimiter: 'SEMI_COLON', rowIteratorPath: '$[*]' };
  const nameField = { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' };

  const transformJson = (options: object, inputData: unknown, source: CacheMetadataSource = { source: 'test' }) =>
    new JSONToCSVTransformer(logger, testData.transformers.list[0], options).transform(
      Readable.from(JSON.stringify(inputData)),
      source,
      'input.json'
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

  it('should transform data from a stream and return metadata when regex matches', async () => {
    const options = {
      ...baseOptions,
      filename: 'test-output.csv',
      fields: [nameField, { jsonPath: '$[*].id', columnName: 'ID', dataType: 'number' }]
    };

    const result = await transformJson(options, [
      { name: 'Item 1', id: 1 },
      { name: 'Item 2', id: 2 }
    ]);

    assert.deepStrictEqual(unparsedRows(), [
      { Name: 'Item 1', ID: 1 },
      { Name: 'Item 2', ID: 2 }
    ]);
    assertContains(unparseOptions(), { delimiter: ';' });
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

  it('should replace @QueryStartTime and @QueryEndTime with the south history query window', async () => {
    const options = { ...baseOptions, filename: '@QueryStartTime_@QueryEndTime.csv', fields: [nameField] };

    const result = await transformJson(options, [], {
      source: 'south',
      southId: 'south1',
      southName: 'South 1',
      queryTime: '2023-01-01T00:00:00.000Z',
      queryStartTime: '2023-01-01T00:00:00.000Z',
      queryEndTime: '2023-01-01T01:00:00.000Z',
      items: []
    });

    assert.strictEqual(result.metadata.contentFile, '2023_01_01_00_00_00_000_2023_01_01_01_00_00_000.csv');
  });

  it('should handle complex data types (datetime, boolean, object, array) and missing values', async () => {
    const options = {
      ...baseOptions,
      fields: [
        {
          jsonPath: '$[*].createdAt',
          columnName: 'Created At',
          dataType: 'datetime',
          datetimeSettings: { inputType: 'iso-string', inputTimezone: 'UTC', outputType: 'iso-string', outputTimezone: 'UTC' }
        },
        { jsonPath: '$[*].isActive', columnName: 'Active', dataType: 'boolean' },
        { jsonPath: '$[*].details', columnName: 'Details', dataType: 'object' },
        { jsonPath: '$[*].tags', columnName: 'Tags', dataType: 'array' },
        { jsonPath: '$[*].ghostField', columnName: 'Ghost', dataType: 'string' }
      ]
    };

    await transformJson(options, [
      { createdAt: '2023-10-27T10:00:00Z', isActive: 'true', details: { user: 'admin', rights: [1, 2] }, tags: ['urgent', 'work'] }
    ]);

    assert.deepStrictEqual(unparsedRows(), [
      {
        'Created At': '2023-10-27T10:00:00.000Z',
        Active: 'true',
        Details: '{"user":"admin","rights":[1,2]}',
        Tags: '["urgent","work"]',
        Ghost: ''
      }
    ]);
    assertContains(unparseOptions(), { delimiter: ';' });
  });

  it('should return correct manifest settings', () => {
    assert.strictEqual(jsonToCsvManifest.settings.key, 'options');
    assert.strictEqual(jsonToCsvManifest.settings.attributes[0].key, 'filename');
  });

  it('should resolve nested JSON-stringified field via recursive path traversal', async () => {
    const options = { ...baseOptions, fields: [{ jsonPath: '$[*].metadata.nestedField', columnName: 'Nested', dataType: 'string' }] };

    await transformJson(options, [{ metadata: JSON.stringify({ nestedField: 'value' }) }]);

    assert.deepStrictEqual(unparsedRows(), [{ Nested: 'value' }]);
  });

  it('should split multiple metrics embedded in a single JSON-stringified MQTT message into separate CSV rows', async () => {
    const options = {
      ...baseOptions,
      rowIteratorPath: '$[*].message.metrics[*]',
      fields: [
        { jsonPath: '$[*].message.metrics[*].name', columnName: 'Name', dataType: 'string' },
        { jsonPath: '$[*].message.metrics[*].value', columnName: 'Value', dataType: 'number' }
      ]
    };

    // A single MQTT message can carry several metrics in its (JSON-stringified) payload.
    await transformJson(options, [
      {
        message: JSON.stringify({
          metrics: [
            { name: 'TAG.A', value: 1.1 },
            { name: 'TAG.B', value: 2.2 }
          ]
        })
      },
      { message: JSON.stringify({ metrics: [{ name: 'TAG.C', value: 3.3 }] }) }
    ]);

    assert.deepStrictEqual(unparsedRows(), [
      { Name: 'TAG.A', Value: 1.1 },
      { Name: 'TAG.B', Value: 2.2 },
      { Name: 'TAG.C', Value: 3.3 }
    ]);
  });

  it('should resolve a numeric field named "length" inside a JSON-stringified message instead of the string length', async () => {
    const options = { ...baseOptions, fields: [{ jsonPath: '$[*].message.length', columnName: 'Length', dataType: 'number' }] };

    // "message" is a JSON-stringified payload (e.g. MQTT) that itself has a "length" field.
    // Native JSONPath traversal would otherwise resolve "message.length" to the *string's*
    // character count before it gets parsed.
    await transformJson(options, [{ message: JSON.stringify({ length: 0.04146180441257728 }) }]);

    assert.deepStrictEqual(unparsedRows(), [{ Length: 0.04146180441257728 }]);
  });

  it('should serialize an object resolved from a JSON-stringified message as JSON, not "[object Object]"', async () => {
    const options = {
      ...baseOptions,
      fields: [{ jsonPath: '$[*].message.rejectCauses', columnName: 'RejectCauses', dataType: 'string' }]
    };

    await transformJson(options, [{ message: JSON.stringify({ rejectCauses: {} }) }]);

    assert.deepStrictEqual(unparsedRows(), [{ RejectCauses: '{}' }]);
  });

  describe('encoding', () => {
    const encodingCases = [
      {
        title: 'should prepend a UTF-8 BOM when encoding is UTF_8_BOM',
        encoding: 'UTF_8_BOM',
        expected: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('csv content')])
      },
      {
        title: 'should encode output as latin1 when encoding is LATIN_1',
        encoding: 'LATIN_1',
        expected: Buffer.from('csv content', 'latin1')
      },
      {
        title: 'should prepend a UTF-16LE BOM and encode as utf16le when encoding is UTF_16_LE',
        encoding: 'UTF_16_LE',
        expected: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('csv content', 'utf16le')])
      }
    ];
    for (const { title, encoding, expected } of encodingCases) {
      it(title, async () => {
        const result = await transformJson({ ...baseOptions, encoding, fields: [nameField] }, [{ name: 'a' }]);

        assert.deepStrictEqual(result.output, expected);
      });
    }
  });

  it('should fall back to a double quote char when the quote char resolves to an empty string', async () => {
    await transformJson({ ...baseOptions, quoteChar: 'NONE', fields: [nameField] }, [{ name: 'a' }]);

    assertContains(unparseOptions(), { quoteChar: '"', quotes: false });
  });

  describe('fieldProcess', () => {
    const fieldProcessOptions = {
      ...baseOptions,
      encoding: 'UTF_8',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true
    };

    it('should apply fieldProcess expression to the typed value before writing to CSV', async () => {
      const options = {
        ...fieldProcessOptions,
        fields: [
          { ...nameField, fieldProcess: 'value.toUpperCase()' },
          { jsonPath: '$[*].score', columnName: 'Score', dataType: 'number', fieldProcess: 'Math.round(value * 100) / 100' },
          { jsonPath: '$[*].tag', columnName: 'Tag', dataType: 'string', fieldProcess: null }
        ]
      };

      await transformJson(options, [{ name: 'hello', score: 3.14159, tag: 'keep-me' }]);

      assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
      assert.deepStrictEqual(unparsedRows(), [{ Name: 'HELLO', Score: 3.14, Tag: 'keep-me' }]);
      assertContains(unparseOptions(), { delimiter: ';' });
    });

    it('should skip fieldProcess when it is null or empty', async () => {
      const options = {
        ...fieldProcessOptions,
        fields: [
          { ...nameField, fieldProcess: '' },
          { jsonPath: '$[*].id', columnName: 'ID', dataType: 'number', fieldProcess: '   ' }
        ]
      };

      await transformJson(options, [{ name: 'original', id: 42 }]);

      assert.strictEqual(papaparseExports.unparse.mock.calls.length, 1);
      assert.deepStrictEqual(unparsedRows(), [{ Name: 'original', ID: 42 }]);
      assertContains(unparseOptions(), { delimiter: ';' });
    });

    it('should throw a descriptive error when fieldProcess expression is invalid', async () => {
      const options = { ...fieldProcessOptions, fields: [{ ...nameField, fieldProcess: 'value.nonExistentMethod()' }] };

      await assert.rejects(transformJson(options, [{ name: 'hello' }]), /Field process evaluation failed/);
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
