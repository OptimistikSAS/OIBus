import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import FileToModbusTransformer from './file-to-modbus-transformer';
import manifest from './manifest';

describe('FileToModbusTransformer', () => {
  let logger: PinoLogger;
  const mapping = [
    { pointId: 'p1', address: '0x0001', modbusType: 'register' },
    { pointId: 'p2', address: '0x0002', modbusType: 'coil' }
  ];

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the values of the mapped points of a CSV file', async () => {
    const transformer = new FileToModbusTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true },
      pointIdColumn: 'id',
      valueColumn: 'value',
      mapping
    });

    const result = await transformer.transform(Readable.from('id;value\np1;12\np2;true\np3;1\np1;abc'), { source: 'test' }, 'a.csv');

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { address: '0x0001', value: 12, modbusType: 'register' },
      { address: '0x0002', value: true, modbusType: 'coil' }
    ]);
    assert.strictEqual(result.metadata.contentType, 'modbus');
    assert.strictEqual(result.metadata.numberOfElement, 2);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, ['Value "abc" of point "p1" cannot be written into a Modbus register']);
  });

  it('should read the JSONPath fields of a JSON file, and warn about CSV parsing errors', async () => {
    const jsonTransformer = new FileToModbusTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'json', rowIteratorPath: '$.values[*]' },
      pointIdColumn: '$.values[*].tag',
      valueColumn: 'v',
      mapping
    });
    const result = await jsonTransformer.transformInMemory({ values: [{ tag: 'p1', v: 3 }] }, { source: 'test' }, null);
    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ address: '0x0001', value: 3, modbusType: 'register' }]);

    const csvTransformer = new FileToModbusTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      pointIdColumn: 'id',
      valueColumn: 'value',
      mapping
    });
    await csvTransformer.transformInMemory('a,b\n"1,2', { source: 'test' }, null);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, ['[FileToModbus] 2 parsing error(s) in the file of "{"source":"test"}"']);
  });

  it('should expose its manifest: the file input, then the Modbus mapping', () => {
    assert.strictEqual(manifest.id, 'file-to-modbus');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['input', 'pointIdColumn', 'valueColumn', 'mapping']
    );
  });
});
