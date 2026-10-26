import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import FileToOPCUATransformer from './file-to-opcua-transformer';
import manifest from './manifest';

describe('FileToOPCUATransformer', () => {
  let logger: PinoLogger;
  const mapping = [
    { pointId: 'p1', nodeId: 'ns=1;s=Valve1' },
    { pointId: 'p2', nodeId: 'ns=1;s=Speed' }
  ];

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the values of the mapped points of a CSV file', async () => {
    const transformer = new FileToOPCUATransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      pointIdColumn: 'id',
      valueColumn: 'value',
      mapping
    });

    const result = await transformer.transform(Readable.from('id,value\np1,true\np2,\np3,1'), { source: 'test' }, 'a.csv');

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ nodeId: 'ns=1;s=Valve1', value: true }]);
    assert.strictEqual(result.metadata.contentType, 'opcua');
    assert.strictEqual(result.metadata.numberOfElement, 1);
  });

  it('should read the JSONPath fields of a JSON file, and warn about CSV parsing errors', async () => {
    const jsonTransformer = new FileToOPCUATransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'json', rowIteratorPath: '$[*]' },
      pointIdColumn: 'name',
      valueColumn: '$[*].data.value',
      mapping
    });
    const result = await jsonTransformer.transformInMemory('[{"name":"p2","data":{"value":1450}}]', { source: 'test' }, null);
    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ nodeId: 'ns=1;s=Speed', value: 1450 }]);

    const csvTransformer = new FileToOPCUATransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      pointIdColumn: 'id',
      valueColumn: 'value',
      mapping
    });
    await csvTransformer.transformInMemory('a,b\n"1,2', { source: 'test' }, null);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, ['[FileToOPCUA] 2 parsing error(s) in the file of "{"source":"test"}"']);
  });

  it('should expose its manifest: the file input, then the OPCUA mapping', () => {
    assert.strictEqual(manifest.id, 'file-to-opcua');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['input', 'pointIdColumn', 'valueColumn', 'mapping']
    );
  });
});
