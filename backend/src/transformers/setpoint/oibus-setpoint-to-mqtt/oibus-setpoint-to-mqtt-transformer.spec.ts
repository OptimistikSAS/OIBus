import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type OIBusSetpointToMQTTTransformerType from './oibus-setpoint-to-mqtt-transformer';
import setpointToMqttManifest from './manifest';
import { OIBusSetpoint } from '../../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let OIBusSetpointToMQTTTransformer: typeof OIBusSetpointToMQTTTransformerType;

before(() => {
  mockUtils = { generateRandomId: mock.fn(() => 'randomId') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  const mod = reloadModule<{ default: typeof OIBusSetpointToMQTTTransformerType }>(nodeRequire, './oibus-setpoint-to-mqtt-transformer');
  OIBusSetpointToMQTTTransformer = mod.default;
});

describe('OIBusSetpointToMQTTTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.generateRandomId = mock.fn(() => 'randomId');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
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
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

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
