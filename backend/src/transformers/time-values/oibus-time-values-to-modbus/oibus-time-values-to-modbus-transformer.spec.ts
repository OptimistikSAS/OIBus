import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import timeValuesToModbusManifest from './manifest';
import type OIBusTimeValuesToModbusTransformerType from './oibus-time-values-to-modbus-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusTimeValuesToModbusTransformer: typeof OIBusTimeValuesToModbusTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
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

  it('should convert the values of an array in memory, and skip the values a Modbus cannot hold', async () => {
    const options = {
      mapping: [
        { pointId: 'coil1', address: 0x0001, modbusType: 'coil' },
        { pointId: 'coil2', address: 0x0002, modbusType: 'coil' },
        { pointId: 'register1', address: 0x0003, modbusType: 'register' },
        { pointId: 'register2', address: 0x0004, modbusType: 'register' }
      ]
    };
    const transformer = new OIBusTimeValuesToModbusTransformer(logger, testData.transformers.list[0], options);
    const values: Array<OIBusTimeValue> = [
      { pointId: 'coil1', timestamp: testData.constants.dates.DATE_1, data: { value: 'false' } },
      { pointId: 'coil2', timestamp: testData.constants.dates.DATE_1, data: { value: '0' } },
      { pointId: 'register1', timestamp: testData.constants.dates.DATE_1, data: { value: 12.7 } },
      { pointId: 'register2', timestamp: testData.constants.dates.DATE_1, data: { value: 'abc' } }
    ];

    const result = await transformer.transformInMemory(values, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { address: 1, value: false, modbusType: 'coil' },
      { address: 2, value: false, modbusType: 'coil' },
      { address: 3, value: 12, modbusType: 'register' }
    ]);
    assert.strictEqual(result.metadata.numberOfElement, 3);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      'Value "abc" of point "register2" cannot be written into a Modbus register'
    ]);
  });

  it('should parse values when transformInMemory receives a JSON string instead of an array', async () => {
    const transformer = new OIBusTimeValuesToModbusTransformer(logger, testData.transformers.list[0], {
      mapping: [{ pointId: 'coil1', address: 0x0001, modbusType: 'coil' }]
    });
    const values: Array<OIBusTimeValue> = [{ pointId: 'coil1', timestamp: testData.constants.dates.DATE_1, data: { value: 'true' } }];

    const result = await transformer.transformInMemory(JSON.stringify(values), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ address: 1, value: true, modbusType: 'coil' }]);
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
