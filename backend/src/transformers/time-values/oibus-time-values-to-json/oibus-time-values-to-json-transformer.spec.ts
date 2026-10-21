import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import timeValuesToJsonManifest from './manifest';
import type OIBusTimeValuesToJSONTransformerType from './oibus-time-values-to-json-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusTimeValuesToJSONTransformer: typeof OIBusTimeValuesToJSONTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToJSONTransformerType }>(
    nodeRequire,
    './oibus-time-values-to-json-transformer'
  );
  OIBusTimeValuesToJSONTransformer = mod.default;
});

describe('OIBusTimeValuesToJSONTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform data from a stream and return metadata', async () => {
    const transformer = new OIBusTimeValuesToJSONTransformer(logger, testData.transformers.list[0], {});
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 'value1' } },
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_2, data: { value: 'value2', quality: 'good' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.from(JSON.stringify(dataChunks)),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 3,
        contentType: 'any'
      }
    });
  });

  it('should parse content from a JSON string when transformInMemory receives non-array data', async () => {
    const transformer = new OIBusTimeValuesToJSONTransformer(logger, testData.transformers.list[0], {});
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 'value1' } }
    ];

    const result = await transformer.transformInMemory(JSON.stringify(dataChunks), { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.from(JSON.stringify(dataChunks)),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 1,
        contentType: 'any'
      }
    });
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(timeValuesToJsonManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    });
  });
});
