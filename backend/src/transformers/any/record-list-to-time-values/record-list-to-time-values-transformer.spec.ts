import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import recordListToTimeValuesManifest from './manifest';
import type RecordListToTimeValuesTransformerType from './record-list-to-time-values-transformer';

const nodeRequire = createRequire(import.meta.url);

let RecordListToTimeValuesTransformer: typeof RecordListToTimeValuesTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  RecordListToTimeValuesTransformer = reloadModule<{ default: typeof RecordListToTimeValuesTransformerType }>(
    nodeRequire,
    './record-list-to-time-values-transformer'
  ).default;
});

describe('RecordListToTimeValuesTransformer', () => {
  let logger: PinoLogger;

  const options = {
    pointIdColumn: 'reference',
    timestampColumn: 'timestamp',
    valueColumn: 'value',
    timestampSettings: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' }
  };
  const createTransformer = (transformerOptions: object = options) =>
    new RecordListToTimeValuesTransformer(logger, testData.transformers.list[0], transformerOptions);

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform rows from a stream into time values', async () => {
    const rows = [
      { reference: 'p1', timestamp: '2024-01-01 01:00:00', value: 12.5, unit: '°C' },
      { reference: 'p2', timestamp: '2024-01-01 01:00:01', value: 'on', unit: null }
    ];

    const result = await createTransformer().transform(Readable.from(JSON.stringify(rows)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 12.5 } },
      { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', data: { value: 'on' } }
    ]);
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'randomId.json',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'time-values'
    });
    assert.strictEqual(logger.warn.mock.calls.length, 0);
  });

  it('should use the Date objects of database drivers as is, and send other values as text', async () => {
    const rows = [
      { reference: 1, timestamp: new Date('2024-01-01T00:00:00.000Z'), value: true },
      { reference: 'p2', timestamp: new Date('2024-01-01T00:00:01.000Z'), value: new Date('2024-02-01T00:00:00.000Z') }
    ];

    const result = await createTransformer().transformInMemory(rows, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: '1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 'true' } },
      { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', data: { value: '2024-02-01T00:00:00.000Z' } }
    ]);
  });

  it('should skip the rows with a missing value or an invalid timestamp, with a single warning', async () => {
    const rows = [
      { reference: null, timestamp: '2024-01-01 01:00:00', value: 1 },
      { reference: 'p2', timestamp: null, value: 2 },
      { reference: 'p3', timestamp: '2024-01-01 01:00:00', value: null },
      { reference: 'p4', timestamp: 'not a date', value: 4 },
      { reference: 'p5', timestamp: true, value: 5 },
      { reference: 'p6', timestamp: new Date('invalid'), value: 6 },
      { reference: 'p7', timestamp: '2024-01-01 01:00:00', value: 7 }
    ];

    const result = await createTransformer().transformInMemory(
      JSON.stringify(rows.slice(0, 5).concat(rows.slice(6))),
      { source: 'test' },
      null
    );
    const withDate = await createTransformer().transformInMemory([rows[5]], { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: 'p7', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 7 } }
    ]);
    assert.deepStrictEqual(JSON.parse(withDate.output.toString()), []);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '5 row(s) skipped: missing "reference", "timestamp" or "value" value, or invalid timestamp'
    ]);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(recordListToTimeValuesManifest.id, 'record-list-to-time-values');
    assert.strictEqual(recordListToTimeValuesManifest.inputType, 'record-list');
    assert.strictEqual(recordListToTimeValuesManifest.outputType, 'time-values');
    assert.deepStrictEqual(
      recordListToTimeValuesManifest.settings.attributes.map(attribute => attribute.key),
      ['pointIdColumn', 'timestampColumn', 'valueColumn', 'timestampSettings']
    );
  });
});
