import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import testData from '../../tests/utils/test-data';
import { buildFileOutputAttribute, FileOutputSettings, writeFile } from './file-output';

describe('File output', () => {
  const csvSettings: FileOutputSettings = {
    output: {
      fileType: 'csv',
      encoding: 'UTF_8',
      compression: false,
      header: true,
      delimiter: 'SEMI_COLON',
      newline: 'LF',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      nullValue: 'NULL'
    },
    filename: '@SourceFilename_@CurrentDate.csv',
    keepOtherFields: true,
    fields: null
  };
  const jsonSettings: FileOutputSettings = {
    output: { fileType: 'json', encoding: 'UTF_8', compression: false },
    filename: 'out.json',
    keepOtherFields: true,
    fields: []
  };
  const field = (name: string, dataType: string, extra: object = {}) => ({
    field: name,
    name: null,
    dataType,
    fieldProcess: null,
    datetimeSettings: null,
    ...extra
  });
  const write = (settings: object, rows: Array<Record<string, unknown>>) =>
    writeFile(rows as never, settings as FileOutputSettings, { source: 'test' }, 'source.json');

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should write the rows in a CSV file, named with the filename variables', () => {
    const result = write(csvSettings, [
      { id: 'a', value: 1, date: new Date('2024-01-01T00:00:00.000Z') },
      { id: 'b', value: null }
    ]);

    assert.strictEqual(result.contentFile, 'source_2021_01_02_00_00_00_000.csv');
    assert.strictEqual(result.output.toString(), 'id;value;date\na;1;2024-01-01T00:00:00.000Z\nb;;');
  });

  it('should rename, cast and process the configured fields, keeping only them when asked', () => {
    const datetimeSettings = { inputType: 'iso-string', outputType: 'unix-epoch-ms' };
    const result = write(
      {
        ...csvSettings,
        output: { ...csvSettings.output, quoteChar: 'DOUBLE_QUOTE' },
        keepOtherFields: false,
        fields: [
          field('id', 'string', { name: 'Reference', fieldProcess: 'value.toUpperCase()' }),
          field('value', 'number'),
          field('on', 'boolean'),
          field('time', 'datetime', { datetimeSettings }),
          field('data', 'object'),
          field('list', 'array'),
          field('missing', 'string')
        ]
      },
      [{ id: 'a', value: '1.5', on: 'true', time: '2024-01-01T00:00:00.000Z', data: '{"a":1}', list: [1], other: 'dropped' }]
    );

    assert.strictEqual(
      result.output.toString(),
      '"Reference";"value";"on";"time";"data";"list";"missing"\n"A";"1.5";"true";"1704067200000";"{""a"":1}";"[1]";"NULL"'
    );
  });

  it('should write the rows in a JSON file, typing the configured fields', () => {
    const result = write(
      {
        ...jsonSettings,
        fields: [
          field('on', 'boolean'),
          field('data', 'object'),
          field('raw', 'array'),
          field('missing', 'number'),
          field('value', 'string')
        ]
      },
      [{ id: 'a', on: 'false', data: '{"a":1}', raw: 'not json', value: 2 }]
    );

    assert.strictEqual(result.contentFile, 'out.json');
    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { id: 'a', on: false, data: { a: 1 }, raw: 'not json', missing: null, value: '2' }
    ]);
  });

  it('should encode and compress the file', () => {
    const rows = [{ id: 'é' }];
    assert.deepStrictEqual(
      [...write({ ...jsonSettings, output: { ...jsonSettings.output, encoding: 'UTF_8_BOM' } }, rows).output.subarray(0, 3)],
      [0xef, 0xbb, 0xbf]
    );
    assert.strictEqual(write({ ...jsonSettings, output: { ...jsonSettings.output, encoding: 'LATIN_1' } }, rows).output.length, 12);
    assert.deepStrictEqual(
      [...write({ ...jsonSettings, output: { ...jsonSettings.output, encoding: 'UTF_16_LE' } }, rows).output.subarray(0, 2)],
      [0xff, 0xfe]
    );

    const compressed = write({ ...jsonSettings, output: { ...jsonSettings.output, compression: true } }, rows);
    assert.strictEqual(compressed.contentFile, 'out.json.gz');
    assert.strictEqual(zlib.gunzipSync(compressed.output).toString(), '[{"id":"é"}]');
  });

  it('should write a CSV file with the default format', () => {
    const result = write({ ...csvSettings, output: { fileType: 'csv', encoding: 'UTF_8', compression: false } }, [
      { id: 'a', value: null }
    ]);

    assert.strictEqual(result.output.toString(), 'id,value\na,');
  });

  it('should show the CSV format only for a CSV file', () => {
    const attribute = buildFileOutputAttribute('json');
    const [fileType] = attribute.attributes;
    assert.ok(fileType.type === 'string-select' && fileType.defaultValue === 'json');
    assert.deepStrictEqual(
      attribute.enablingConditions.map(condition => condition.targetPathFromRoot),
      ['header', 'delimiter', 'newline', 'quoteChar', 'escapeChar', 'nullValue']
    );
  });
});
