import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusSetpoint } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import setpointToMqttManifest from './manifest';
import type OIBusSetpointToMQTTTransformerType from './oibus-setpoint-to-mqtt-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusSetpointToMQTTTransformer: typeof OIBusSetpointToMQTTTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof OIBusSetpointToMQTTTransformerType }>(nodeRequire, './oibus-setpoint-to-mqtt-transformer');
  OIBusSetpointToMQTTTransformer = mod.default;
});

describe('OIBusSetpointToMQTTTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      mapping: [
        { reference: 'reference1', topic: '/oibus/reference1' },
        { reference: 'reference2', topic: '/oibus/reference2' }
      ]
    };
    const transformer = new OIBusSetpointToMQTTTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusSetpoint> = [
      { reference: 'reference1', value: 1 },
      { reference: 'reference2', value: '2' },
      { reference: 'reference3', value: 'value1' }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.from(
        JSON.stringify([
          { topic: '/oibus/reference1', payload: '1' },
          { topic: '/oibus/reference2', payload: '2' }
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

  it('should parse setpoints when transformInMemory receives a JSON string instead of an array', async () => {
    const options = {
      mapping: [{ reference: 'reference1', topic: '/oibus/reference1' }]
    };
    const transformer = new OIBusSetpointToMQTTTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusSetpoint> = [{ reference: 'reference1', value: '1' }];

    const result = await transformer.transformInMemory(JSON.stringify(dataChunks), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ topic: '/oibus/reference1', payload: '1' }]);
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(setpointToMqttManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'reference',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.reference',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'topic',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.topic',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 6, displayInViewMode: true }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { visible: true, wrapInBox: false }
    });
  });
});
