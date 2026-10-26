import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import FileToRecordListTransformer from './file-to-record-list-transformer';
import manifest from './manifest';

describe('FileToRecordListTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should send the rows of a CSV file as records', async () => {
    const transformer = new FileToRecordListTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true }
    });

    const result = await transformer.transform(
      Readable.from('pointId,timestamp,value\np1,2024-01-01T00:00:00.000Z,1'),
      { source: 'test' },
      'a.csv'
    );

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1 }]);
    assert.strictEqual(result.metadata.contentType, 'record-list');
    assert.strictEqual(result.metadata.numberOfElement, 1);
    assert.strictEqual(logger.warn.mock.callCount(), 0);
  });

  it('should send the nodes of a JSON file as records, and warn about CSV parsing errors', async () => {
    const jsonTransformer = new FileToRecordListTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'json', rowIteratorPath: '$.rows[*]' }
    });
    const result = await jsonTransformer.transformInMemory('{"rows":[{"a":1},{"a":2}]}', { source: 'test' }, null);
    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ a: 1 }, { a: 2 }]);

    const csvTransformer = new FileToRecordListTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true }
    });
    await csvTransformer.transformInMemory('a,b\n"1,2', { source: 'test' }, null);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, [
      '[FileToRecordList] 2 parsing error(s) in the file of "{"source":"test"}"'
    ]);
  });

  it('should expose its manifest', () => {
    assert.strictEqual(manifest.id, 'file-to-record-list');
    assert.deepStrictEqual(
      manifest.settings.attributes.map(attribute => attribute.key),
      ['input']
    );
  });
});
