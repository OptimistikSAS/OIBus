import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './record-list-to-opcua-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './record-list-to-opcua-transformer').default;
});

const metadata = (numberOfElement: number, contentType: string) => ({
  contentFile: 'randomId.json',
  contentSize: 0,
  createdAt: '',
  numberOfElement,
  contentType
});

describe('RecordListToOPCUATransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the value of the mapped records', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'pointId',
      valueColumn: 'value',
      mapping: [
        { pointId: 'p1', nodeId: 'ns=1;s=p1' },
        { pointId: 'p3', nodeId: 'ns=1;s=p3' }
      ]
    });
    const records = [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1 },
      { pointId: 'p2', timestamp: '2024-01-01T00:00:00.000Z', value: 2 },
      { pointId: 'p3', timestamp: '2024-01-01T00:00:00.000Z' }
    ];

    const result = await transformer.transform(Readable.from(JSON.stringify(records)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ nodeId: 'ns=1;s=p1', value: 1 }]);
    assert.deepStrictEqual(result.metadata, metadata(1, 'opcua'));
  });

  it('should read the configured columns of rows', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {
      pointIdColumn: 'tag',
      valueColumn: 'reading',
      mapping: [{ pointId: 'a', nodeId: 'ns=1;s=a' }]
    });

    const result = await transformer.transformInMemory([{ tag: 'a', reading: true }], { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ nodeId: 'ns=1;s=a', value: true }]);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'record-list-to-opcua');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['pointIdColumn', 'valueColumn', 'mapping']
    );
  });
});
