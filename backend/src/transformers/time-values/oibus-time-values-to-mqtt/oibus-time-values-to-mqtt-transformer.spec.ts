import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import timeValuesToMqttManifest from './manifest';
import type OIBusTimeValuesToMQTTTransformerType from './oibus-time-values-to-mqtt-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusTimeValuesToMQTTTransformer: typeof OIBusTimeValuesToMQTTTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToMQTTTransformerType }>(
    nodeRequire,
    './oibus-time-values-to-mqtt-transformer'
  );
  OIBusTimeValuesToMQTTTransformer = mod.default;
});

describe('OIBusTimeValuesToMQTTTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      mapping: [
        { pointId: 'reference1', topic: '/oibus/reference1' },
        { pointId: 'reference2', topic: '/oibus/reference2' }
      ]
    };
    const transformer = new OIBusTimeValuesToMQTTTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: '1' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_2, data: { value: '2', quality: 'good' } },
      { pointId: 'reference3', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.from(
        JSON.stringify([
          { topic: '/oibus/reference1', payload: JSON.stringify({ value: '1', timestamp: testData.constants.dates.DATE_1 }) },
          {
            topic: '/oibus/reference2',
            payload: JSON.stringify({ value: '2', quality: 'good', timestamp: testData.constants.dates.DATE_2 })
          }
        ])
      ),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'mqtt'
      }
    });
  });

  it('should transform the values of an array or of a JSON string in memory', async () => {
    const transformer = new OIBusTimeValuesToMQTTTransformer(logger, testData.transformers.list[0], {
      mapping: [{ pointId: 'reference1', topic: 'topic1' }]
    });
    const values: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 1 } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_1, data: { value: 2 } }
    ];
    const expected = [{ topic: 'topic1', payload: JSON.stringify({ value: 1, timestamp: testData.constants.dates.DATE_1 }) }];

    const fromArray = await transformer.transformInMemory(values, { source: 'test' }, null);
    const fromString = await transformer.transformInMemory(JSON.stringify(values), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(fromArray.output.toString()), expected);
    assert.deepStrictEqual(JSON.parse(fromString.output.toString()), expected);
    assert.strictEqual(fromArray.metadata.numberOfElement, 1);
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(timeValuesToMqttManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'pointId',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.point-id',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'topic',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-mqtt.mapping.topic',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    });
  });
});
