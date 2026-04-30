import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import {flushPromises, mockModule, reloadModule} from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type OIBusTimeValuesToModbusTransformerType from './oibus-time-values-to-modbus-transformer';
import timeValuesToModbusManifest from './manifest';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let OIBusTimeValuesToModbusTransformer: typeof OIBusTimeValuesToModbusTransformerType;

before(() => {
  mockUtils = { generateRandomId: mock.fn(() => 'randomId') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToModbusTransformerType }>(
    nodeRequire,
    './oibus-time-values-to-modbus-transformer'
  );
  OIBusTimeValuesToModbusTransformer = mod.default;
});

describe('OIBusTimeValuesToModbusTransformer', () => {
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
        { pointId: 'reference1', address: 0x0001, modbusType: 'coil' },
        { pointId: 'reference2', address: 0x0002, modbusType: 'holding-register' }
      ]
    };
    const transformer = new OIBusTimeValuesToModbusTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: '1' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_2, data: { value: '2', quality: 'good' } },
      { pointId: 'reference3', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
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
          { address: 1, value: true, modbusType: 'coil' },
          { address: 2, value: 2, modbusType: 'holding-register' }
        ])
      ),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'modbus'
      }
    });
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(timeValuesToModbusManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'pointId',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.point-id',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'address',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.address',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              },
              {
                type: 'string-select',
                key: 'modbusType',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.modbus-type',
                defaultValue: 'register',
                selectableValues: ['coil', 'register'],
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
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
