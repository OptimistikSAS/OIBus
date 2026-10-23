import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import manifest from './manifest';
import type TransformerType from './record-list-to-modbus-transformer';

const nodeRequire = createRequire(import.meta.url);

let Transformer: typeof TransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  Transformer = reloadModule<{ default: typeof TransformerType }>(nodeRequire, './record-list-to-modbus-transformer').default;
});

const metadata = (numberOfElement: number, contentType: string) => ({
  contentFile: 'randomId.json',
  contentSize: 0,
  createdAt: '',
  numberOfElement,
  contentType
});

describe('RecordListToModbusTransformer', () => {
  let logger: PinoLogger;
  const options = {
    pointIdColumn: 'pointId',
    valueColumn: 'value',
    mapping: [
      { pointId: 'coil1', address: '0x0001', modbusType: 'coil' },
      { pointId: 'register1', address: '0x0002', modbusType: 'register' },
      { pointId: 'register2', address: '0x0003', modbusType: 'register' }
    ]
  };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the converted value of the mapped records', async () => {
    const records = [
      { pointId: 'coil1', timestamp: '2024-01-01T00:00:00.000Z', value: 'false' },
      { pointId: 'register1', timestamp: '2024-01-01T00:00:00.000Z', value: 12.7 },
      { pointId: 'other', timestamp: '2024-01-01T00:00:00.000Z', value: 1 }
    ];

    const result = await new Transformer(logger, testData.transformers.list[0], options).transform(
      Readable.from(JSON.stringify(records)),
      { source: 'test' },
      null
    );

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { address: '0x0001', value: false, modbusType: 'coil' },
      { address: '0x0002', value: 12, modbusType: 'register' }
    ]);
    assert.deepStrictEqual(result.metadata, metadata(2, 'modbus'));
  });

  it('should skip the values a Modbus cannot hold', async () => {
    const result = await new Transformer(logger, testData.transformers.list[0], options).transformInMemory(
      [{ pointId: 'register2', value: 'abc' }],
      { source: 'test' },
      null
    );

    assert.deepStrictEqual(JSON.parse(result.output.toString()), []);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      'Value "abc" of point "register2" cannot be written into a Modbus register'
    ]);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'record-list-to-modbus');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['pointIdColumn', 'valueColumn', 'mapping']
    );
  });
});
