import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type TransformerType from './file-transformer';
import manifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './file-transformer').default;
});

describe('FileTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should keep a file as is, with its name', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {});
    const content = Buffer.from([0x1f, 0x8b, 0x00, 0xff]);

    const result = await transformer.transform(Readable.from([content.subarray(0, 2), content.subarray(2)]), { source: 'test' }, 'file.gz');

    assert.deepStrictEqual(result, {
      output: content,
      metadata: { contentFile: 'file.gz', contentSize: 0, createdAt: '', numberOfElement: 0, contentType: 'any' }
    });
  });

  it('should write a payload as a JSON file', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {});

    const result = await transformer.transformInMemory('{"a":1}', { source: 'test' }, null);

    assert.strictEqual(result.output.toString(), '{"a":1}');
    assert.strictEqual(result.metadata.contentFile, 'randomId.json');
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'file');
    assert.strictEqual(manifest.inputType, 'any');
    assert.strictEqual(manifest.outputType, 'any');
    assert.deepStrictEqual(manifest.settings.attributes, []);
  });
});
