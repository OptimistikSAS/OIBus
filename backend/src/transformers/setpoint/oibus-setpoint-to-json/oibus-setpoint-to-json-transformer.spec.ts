import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './oibus-setpoint-to-json-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './oibus-setpoint-to-json-transformer').default;
});

describe('OIBusSetpointToJSONTransformer', () => {
  let logger: PinoLogger;
  const setpoints = [
    { reference: 'temperature', value: 22 },
    { reference: 'mode', value: 'auto' }
  ];

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the setpoints as a JSON file, from memory, from a string or from a stream', async () => {
    const transformer = new Transformer(logger, testData.transformers.list[0], {});

    const results = [
      await transformer.transformInMemory(setpoints, { source: 'test' }, null),
      await transformer.transformInMemory(JSON.stringify(setpoints), { source: 'test' }, null),
      await transformer.transform(Readable.from(JSON.stringify(setpoints)), { source: 'test' }, null)
    ];

    for (const result of results) {
      assert.deepStrictEqual(JSON.parse(result.output.toString()), setpoints);
      assert.deepStrictEqual(result.metadata, {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'any'
      });
    }
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'setpoint-to-json');
    assert.strictEqual(manifest.inputType, 'setpoint');
    assert.strictEqual(manifest.outputType, 'any');
  });
});
