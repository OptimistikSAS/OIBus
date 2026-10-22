import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusSetpoint } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import setpointToModbusManifest from './manifest';
import type OIBusSetpointToModbusTransformerType from './oibus-setpoint-to-modbus-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusSetpointToModbusTransformer: typeof OIBusSetpointToModbusTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof OIBusSetpointToModbusTransformerType }>(nodeRequire, './oibus-setpoint-to-modbus-transformer');
  OIBusSetpointToModbusTransformer = mod.default;
});

describe('OIBusSetpointToModbusTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      mapping: [
        { reference: 'reference1', address: 0x0001, modbusType: 'coil' },
        { reference: 'reference2', address: 0x0002, modbusType: 'holding-register' }
      ]
    };
    const transformer = new OIBusSetpointToModbusTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusSetpoint> = [
      { reference: 'reference1', value: '1' },
      { reference: 'reference2', value: '2' },
      { reference: 'reference3', value: 'value1' }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

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

  it('should parse setpoints when transformInMemory receives a JSON string instead of an array', async () => {
    const options = {
      mapping: [{ reference: 'reference1', address: 0x0001, modbusType: 'coil' }]
    };
    const transformer = new OIBusSetpointToModbusTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusSetpoint> = [{ reference: 'reference1', value: '1' }];

    const result = await transformer.transformInMemory(JSON.stringify(dataChunks), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ address: 1, value: true, modbusType: 'coil' }]);
  });

  it('should skip the setpoints a Modbus cannot hold', async () => {
    const transformer = new OIBusSetpointToModbusTransformer(logger, testData.transformers.list[0], {
      mapping: [
        { reference: 'coil1', address: 0x0001, modbusType: 'coil' },
        { reference: 'register1', address: 0x0002, modbusType: 'register' }
      ]
    });
    const setpoints: Array<OIBusSetpoint> = [
      { reference: 'coil1', value: 'false' },
      { reference: 'register1', value: 'on' }
    ];

    const result = await transformer.transformInMemory(setpoints, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ address: 1, value: false, modbusType: 'coil' }]);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      'Value "on" of setpoint "register1" cannot be written into a Modbus register'
    ]);
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(setpointToModbusManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'reference',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.reference',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'address',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.address',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              },
              {
                type: 'string-select',
                key: 'modbusType',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-modbus.mapping.modbus-type',
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
