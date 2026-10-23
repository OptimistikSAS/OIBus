import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type JSONToTimeValuesTransformerType from './json-to-time-values-transformer';
import jsonToTimeValuesManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let JSONToTimeValuesTransformer: typeof JSONToTimeValuesTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  JSONToTimeValuesTransformer = reloadModule<{ default: typeof JSONToTimeValuesTransformerType }>(
    nodeRequire,
    './json-to-time-values-transformer'
  ).default;
});

describe('JSONToTimeValuesTransformer', () => {
  let logger: PinoLogger;

  const options = {
    rowIteratorPath: '$[*]',
    pointId: '$[*].id',
    value: '$[*].val',
    timestamp: '$[*].ts',
    datetimeSettings: { inputType: 'iso-string', inputTimezone: 'UTC' }
  };
  const payload = [
    { id: 'p1', val: 12.5, ts: '2024-01-01T00:00:00.000Z' },
    { id: 'p2', val: 'on', ts: '2024-01-01T00:00:01.000Z' }
  ];
  const expectedValues = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 12.5 } },
    { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', data: { value: 'on' } }
  ];
  const expectedMetadata = { contentFile: 'randomId.json', contentSize: 0, createdAt: '', numberOfElement: 2, contentType: 'time-values' };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform a JSON payload from a stream into time values', async () => {
    const transformer = new JSONToTimeValuesTransformer(logger, testData.transformers.list[0], options);

    const result = await transformer.transform(Readable.from(JSON.stringify(payload)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), expectedValues);
    assert.deepStrictEqual(result.metadata, expectedMetadata);
  });

  it('should transform an in-memory payload or its serialised string', async () => {
    const transformer = new JSONToTimeValuesTransformer(logger, testData.transformers.list[0], options);

    const fromObject = await transformer.transformInMemory(payload, { source: 'test' }, null);
    const fromString = await transformer.transformInMemory(JSON.stringify(payload), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(fromObject.output.toString()), expectedValues);
    assert.deepStrictEqual(JSON.parse(fromString.output.toString()), expectedValues);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(jsonToTimeValuesManifest.id, 'json-to-time-values');
    assert.strictEqual(jsonToTimeValuesManifest.inputType, 'any');
    assert.strictEqual(jsonToTimeValuesManifest.outputType, 'time-values');
    assert.deepStrictEqual(
      jsonToTimeValuesManifest.settings.attributes.map(attribute => attribute.key),
      ['rowIteratorPath', 'pointId', 'value', 'timestamp', 'datetimeSettings']
    );
  });
});
