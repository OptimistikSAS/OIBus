import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './record-list-to-json-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './record-list-to-json-transformer').default;
});

const metadata = (numberOfElement: number, contentType: string) => ({
  contentFile: 'randomId.json',
  contentSize: 0,
  createdAt: '',
  numberOfElement,
  contentType
});

describe('RecordListToJSONTransformer', () => {
  let logger: PinoLogger;
  const records = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' },
    { id: 2, name: 'row' }
  ];

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the records as a JSON file, from memory or from a stream', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {});

    const fromMemory = await transformer.transformInMemory(records, { source: 'test' }, null);
    const fromStream = await transformer.transform(Readable.from(JSON.stringify(records)), { source: 'test' }, null);

    for (const result of [fromMemory, fromStream]) {
      assert.deepStrictEqual(JSON.parse(result.output.toString()), records);
      assert.deepStrictEqual(result.metadata, metadata(2, 'any'));
    }
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'record-list-to-json');
    assert.strictEqual(manifest.inputType, 'record-list');
    assert.deepStrictEqual(manifest.settings.attributes, []);
  });
});
