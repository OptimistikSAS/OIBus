import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './record-list-to-oianalytics-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './record-list-to-oianalytics-transformer').default;
});

const metadata = (numberOfElement: number, contentType: string) => ({
  contentFile: 'randomId.json',
  contentSize: 0,
  createdAt: '',
  numberOfElement,
  contentType
});

describe('RecordListToOIAnalyticsTransformer', () => {
  let logger: PinoLogger;
  const options = {
    pointIdColumn: 'pointId',
    timestampColumn: 'timestamp',
    valueColumn: 'value',
    timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' },
    precision: 'ms',
    referenceProcess: null
  };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should send the point records in the OIAnalytics compact format', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], options);
    const records = [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' },
      { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', value: 'on' }
    ];

    const result = await transformer.transform(Readable.from(JSON.stringify(records)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2024-01-01T00:00:00.000Z', '2024-01-01T00:00:01.000Z'],
      values: [1, 'on'],
      references: ['p1', 'p2']
    });
    assert.deepStrictEqual(result.metadata, metadata(2, 'oianalytics'));
  });

  it('should read the configured columns of rows, truncate the timestamps and process the references', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'tag',
      timestampColumn: 'date',
      valueColumn: 'reading',
      timestampSettings: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' },
      precision: 'min',
      referenceProcess: 'value.toUpperCase()'
    });
    const rows = [
      { tag: 'a', date: '2024-01-01 01:00:30', reading: 1 },
      { tag: 2, date: new Date('2024-01-01T00:01:30.000Z'), reading: 2 }
    ];

    const result = await transformer.transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2024-01-01T00:00:00.000Z', '2024-01-01T00:01:00.000Z'],
      values: [1, 2],
      references: ['A', '2']
    });
  });

  it('should skip the records without point, value or valid timestamp, with a single warning', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], options);
    const records = [
      { timestamp: '2024-01-01T00:00:00.000Z', value: 1 },
      { pointId: 'p2', value: 2 },
      { pointId: 'p3', timestamp: 'invalid', value: 3 },
      { pointId: 'p4', timestamp: true, value: 4 },
      { pointId: 'p5', timestamp: '2024-01-01T00:00:00.000Z' },
      { pointId: 'p6', timestamp: '2024-01-01T00:00:00.000Z', value: 6 }
    ];

    const result = await transformer.transformInMemory(records, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()).references, ['p6']);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '5 record(s) skipped: missing "pointId", "timestamp" or "value" value, or invalid timestamp'
    ]);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'record-list-to-oianalytics');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['pointIdColumn', 'timestampColumn', 'valueColumn', 'timestampSettings', 'precision', 'referenceProcess']
    );
  });
});
