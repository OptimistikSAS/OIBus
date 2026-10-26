import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import FileToFileTransformer from './file-to-file-transformer';
import manifest from './manifest';

describe('FileToFileTransformer', () => {
  let logger: PinoLogger;
  const csvOutput = {
    fileType: 'csv',
    encoding: 'UTF_8',
    compression: false,
    header: true,
    delimiter: 'SEMI_COLON',
    newline: 'LF',
    quoteChar: 'NONE',
    escapeChar: 'DOUBLE_QUOTE',
    nullValue: ''
  };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should convert a JSON file into a CSV file, reading the JSONPath fields', async () => {
    const transformer = new FileToFileTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'json', rowIteratorPath: '$.data[*]' },
      output: csvOutput,
      filename: '@SourceFilename.csv',
      keepOtherFields: false,
      fields: [
        { field: '$.data[*].tag', name: 'Tag', dataType: 'string', fieldProcess: null },
        { field: 'val', name: 'Value', dataType: 'number', fieldProcess: null }
      ]
    });
    const content = {
      data: [
        { tag: 't1', val: '1.5' },
        { tag: 't2', val: 2 }
      ]
    };

    const result = await transformer.transform(Readable.from(JSON.stringify(content)), { source: 'test' }, 'report.json');

    assert.strictEqual(result.output.toString(), 'Tag;Value\nt1;1.5\nt2;2');
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'report.csv',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'file'
    });
  });

  it('should convert a CSV file into a JSON file, and warn about its parsing errors', async () => {
    const transformer = new FileToFileTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: 'out.json',
      keepOtherFields: true,
      fields: null
    });

    const result = await transformer.transformInMemory('a,b\n1,"x', { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [{ a: 1, b: 'x' }]);
    assert.deepStrictEqual(logger.warn.mock.calls[0].arguments, ['[FileToFile] 1 parsing error(s) in the file of "{"source":"test"}"']);
  });

  it('should only rename another file', async () => {
    const transformer = new FileToFileTransformer(logger, testData.transformers.list[0], {
      input: { fileType: 'other' },
      filename: '@SourceFilename_copy@SourceExtension'
    });
    const content = Buffer.from([0x00, 0xff, 0x10]);

    const result = await transformer.transform(Readable.from([content]), { source: 'test' }, 'image.bin');
    assert.deepStrictEqual(result.output, content);
    assert.strictEqual(result.metadata.contentFile, 'image_copy.bin');

    const payload = await transformer.transformInMemory({ a: 1 }, { source: 'test' }, null);
    assert.strictEqual(payload.output.toString(), '{"a":1}');
    assert.strictEqual(payload.metadata.contentFile, '_copy');
  });

  it('should hide the output and the fields of another file', () => {
    assert.deepStrictEqual(
      manifest.settings.enablingConditions.map(condition => [
        condition.referralPathFromRoot,
        condition.targetPathFromRoot,
        condition.values
      ]),
      [
        ['input.fileType', 'output', ['csv', 'json']],
        ['input.fileType', 'keepOtherFields', ['csv', 'json']],
        ['input.fileType', 'fields', ['csv', 'json']]
      ]
    );
  });
});
