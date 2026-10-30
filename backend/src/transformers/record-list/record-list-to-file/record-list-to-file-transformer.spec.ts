import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import manifest from './manifest';
import RecordListToFileTransformer from './record-list-to-file-transformer';

describe('RecordListToFileTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should write the records in a CSV file', async () => {
    const transformer = new RecordListToFileTransformer(logger, testData.transformers.list[0], {
      output: {
        fileType: 'csv',
        encoding: 'UTF_8',
        compression: false,
        header: true,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: ''
      },
      filename: 'records.csv',
      keepOtherFields: true,
      fields: null
    });

    const result = await transformer.transform(Readable.from(JSON.stringify([{ pointId: 'p1', value: 1 }])), { source: 'test' }, null);

    assert.strictEqual(result.output.toString(), 'pointId,value\np1,1');
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'records.csv',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 1,
      contentType: 'file'
    });
  });

  it('should send the records as they are in a JSON file when configured so', async () => {
    const transformer = new RecordListToFileTransformer(logger, testData.transformers.list[0], {
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: 'records.json',
      keepOtherFields: true,
      fields: []
    });
    const records = [{ pointId: 'p1', value: 1, quality: 'Good' }];

    const result = await transformer.transformInMemory(records, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), records);
    // the manifest defaults to a CSV file, named after the connector, the item, the query start and the current date
    const [output, filename] = manifest.settings.attributes;
    assert.ok(output.type === 'object' && output.attributes[0].type === 'string-select' && output.attributes[0].defaultValue === 'csv');
    assert.ok(filename.type === 'string' && filename.defaultValue === '@ConnectorName-@ItemName-@QueryStartTime-@CurrentDate.csv');
  });
});
