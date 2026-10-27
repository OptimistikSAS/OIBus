import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './record-list-to-mqtt-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './record-list-to-mqtt-transformer').default;
});

const metadata = (numberOfElement: number, contentType: string) => ({
  contentFile: 'randomId.json',
  contentSize: 0,
  createdAt: '',
  numberOfElement,
  contentType
});

describe('RecordListToMQTTTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should publish the mapped records without their point column', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'pointId',
      payload: 'record',
      mapping: [{ pointId: 'p1', topic: 'topic/p1' }]
    });
    const records = [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' },
      { pointId: 'p2', timestamp: '2024-01-01T00:00:00.000Z', value: 2 }
    ];

    const result = await transformer.transform(Readable.from(JSON.stringify(records)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { topic: 'topic/p1', payload: JSON.stringify({ timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' }) }
    ]);
    assert.deepStrictEqual(result.metadata, metadata(1, 'mqtt'));
  });

  it('should read the point from another column of the rows', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'id',
      payload: 'record',
      mapping: [{ pointId: '12', topic: 'topic/12' }]
    });

    const result = await transformer.transformInMemory([{ id: 12, temperature: 20 }, { name: 'no id' }], { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ topic: 'topic/12', payload: JSON.stringify({ temperature: 20 }) }]);
  });

  it('should publish the whole record when the payload is not set', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'pointId',
      mapping: [{ pointId: 'p1', topic: 'topic/p1' }]
    });

    const result = await transformer.transformInMemory([{ pointId: 'p1', value: 1 }], { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ topic: 'topic/p1', payload: JSON.stringify({ value: 1 }) }]);
  });

  it('should publish the value alone, text as it is and other values as JSON', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'reference',
      payload: 'value',
      valueColumn: 'value',
      mapping: [
        { pointId: 'mode', topic: 'topic/mode' },
        { pointId: 'temperature', topic: 'topic/temperature' },
        { pointId: 'enabled', topic: 'topic/enabled' },
        { pointId: 'missing', topic: 'topic/missing' }
      ]
    });
    const setpoints = [
      { reference: 'mode', value: 'auto' },
      { reference: 'temperature', value: 22.5 },
      { reference: 'enabled', value: true },
      { reference: 'missing' },
      { reference: 'unmapped', value: 1 }
    ];

    const result = await transformer.transformInMemory(setpoints, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { topic: 'topic/mode', payload: 'auto' },
      { topic: 'topic/temperature', payload: '22.5' },
      { topic: 'topic/enabled', payload: 'true' },
      { topic: 'topic/missing', payload: 'null' }
    ]);
    assert.deepStrictEqual(result.metadata, metadata(4, 'mqtt'));
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'record-list-to-mqtt');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['pointIdColumn', 'payload', 'valueColumn', 'mapping']
    );
    assert.deepStrictEqual(manifest.settings.enablingConditions, [
      { referralPathFromRoot: 'payload', targetPathFromRoot: 'valueColumn', values: ['value'] }
    ]);
  });
});
