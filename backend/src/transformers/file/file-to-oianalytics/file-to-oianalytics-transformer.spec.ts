import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type TransformerType from './file-to-oianalytics-transformer';
import manifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './file-to-oianalytics-transformer').default;
});

describe('FileToOIAnalyticsTransformer', () => {
  let logger: PinoLogger;
  const payloadOptions = {
    reference: { referenceField: 'pointId', referenceProcess: null },
    timestamp: { timestampField: 'timestamp', sourceType: 'iso-string', precision: 'ms' },
    value: { valueField: 'value', valueProcess: null }
  };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should send the rows of a CSV file in the OIAnalytics compact format', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true },
      ...payloadOptions
    });

    const result = await transformer.transform(
      Readable.from('pointId;timestamp;value\np1;2024-01-01T00:00:00.000Z;1\np2;2024-01-01T00:00:01.000Z;on'),
      { source: 'test' },
      'a.csv'
    );

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2024-01-01T00:00:00.000Z', '2024-01-01T00:00:01.000Z'],
      values: [1, 'on'],
      references: ['p1', 'p2']
    });
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'randomId.json',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'oianalytics'
    });
  });

  it('should read the JSONPath fields of a JSON file, process the references and values and truncate the timestamps', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      input: { fileType: 'json', rowIteratorPath: '$.metrics[*]' },
      reference: { referenceField: '$.metrics[*].name', referenceProcess: 'value.toUpperCase()' },
      timestamp: { timestampField: '$.time', sourceType: 'unix-epoch-ms', precision: 's' },
      value: { valueField: 'reading', valueProcess: 'value * 2' }
    });
    const content = { time: 1704067200123, metrics: [{ name: 'a', reading: 1 }, { name: 'b' }] };

    const result = await transformer.transformInMemory(content, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2024-01-01T00:00:00.000Z'],
      values: [2],
      references: ['A']
    });
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '1 record(s) skipped: missing "$.metrics[*].name", "$.time" or "reading" value, or invalid timestamp'
    ]);
  });

  it('should warn about the parsing errors of a CSV file', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      ...payloadOptions
    });

    await transformer.transformInMemory('a,b\n"1,2', { source: 'test' }, null);

    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '[FileToOIAnalytics] 2 parsing error(s) in the file of "{"source":"test"}"'
    ]);
  });

  it('should expose its manifest: the file input, then the OIAnalytics payload', () => {
    assert.strictEqual(manifest.id, 'file-to-oianalytics');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['input', 'reference', 'timestamp', 'value']
    );
  });
});
