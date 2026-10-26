import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_9';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');
const NOW = '2026-01-01T00:00:00.000Z';

const caching = {
  caching_trigger_schedule: 'sm1',
  caching_trigger_number_of_elements: 1000,
  caching_trigger_number_of_files: 1,
  caching_throttling_cache_max_size: 0,
  caching_throttling_max_number_of_elements: 10_000,
  caching_error_retry_interval: 5000,
  caching_error_retry_count: 3,
  caching_archive_enabled: false,
  caching_archive_retention_duration: 0
};

describe('Entity migration v3.10.0_9', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_9.ts', db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const northLink = (id: string, transformerId: string, options: object | null) => ({
    id,
    north_id: 'north1',
    transformer_id: transformerId,
    options: options ? JSON.stringify(options) : null,
    source_type: 'oibus-api'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({ ...caching, id: 'north1', name: 'North 1', type: 'oianalytics', enabled: true, settings: '{}' });
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'mysql',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'jsonToCsv', type: 'standard', function_name: 'json-to-csv', input_type: 'file', output_type: 'file' },
      { id: 'csv', type: 'standard', function_name: 'record-list-to-csv', input_type: 'record-list', output_type: 'file' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'file' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should replace the CSV and JSON writers by the file ones, converting their options', async () => {
    const datetimeSettings = { inputType: 'iso-string', outputType: 'unix-epoch-ms' };
    await db('north_transformers').insert([
      northLink('jsonToCsv', 'jsonToCsv', {
        filename: 'report.csv',
        encoding: 'LATIN_1',
        header: false,
        delimiter: 'TAB',
        newline: 'CRLF',
        quoteChar: 'DOUBLE_QUOTE',
        escapeChar: 'BACKSLASH',
        nullValue: 'NULL',
        rowIteratorPath: '$.data[*]',
        fields: [{ columnName: 'Time', jsonPath: '$.data[*].ts', dataType: 'datetime', fieldProcess: null, datetimeSettings }]
      }),
      northLink('json', 'json', {})
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'csv',
      options: JSON.stringify({
        filename: '@CurrentDate.csv',
        encoding: 'UTF_8',
        header: true,
        compression: true,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: '',
        keepOtherFields: false,
        fields: [{ fieldName: 'value', columnName: null, dataType: 'number', fieldProcess: 'value * 2' }]
      })
    });

    await up(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name').orderBy('id'), [
      { id: 'csv', function_name: 'record-list-to-file' },
      { id: 'jsonToCsv', function_name: 'file-to-file' }
    ]);
    assert.deepStrictEqual(await linkOf('north_transformers', 'jsonToCsv'), {
      transformerId: 'jsonToCsv',
      options: {
        input: { fileType: 'json', rowIteratorPath: '$.data[*]' },
        output: {
          fileType: 'csv',
          encoding: 'LATIN_1',
          compression: false,
          header: false,
          delimiter: 'TAB',
          newline: 'CRLF',
          quoteChar: 'DOUBLE_QUOTE',
          escapeChar: 'BACKSLASH',
          nullValue: 'NULL'
        },
        filename: 'report.csv',
        keepOtherFields: false,
        fields: [{ field: '$.data[*].ts', name: 'Time', dataType: 'datetime', fieldProcess: null, datetimeSettings }]
      }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'json'), {
      transformerId: 'csv',
      options: {
        output: { fileType: 'json', encoding: 'UTF_8', compression: false },
        filename: '@CurrentDate.json',
        keepOtherFields: true,
        fields: []
      }
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'history'), {
      transformerId: 'csv',
      options: {
        output: {
          fileType: 'csv',
          encoding: 'UTF_8',
          compression: true,
          header: true,
          delimiter: 'COMMA',
          newline: 'LF',
          quoteChar: 'NONE',
          escapeChar: 'DOUBLE_QUOTE',
          nullValue: ''
        },
        filename: '@CurrentDate.csv',
        keepOtherFields: false,
        fields: [{ field: 'value', name: null, dataType: 'number', fieldProcess: 'value * 2' }]
      }
    });
  });

  it('should keep the options already converted, and fill the missing ones', async () => {
    const converted = {
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: 'a.json',
      keepOtherFields: true,
      fields: []
    };
    await db('north_transformers').insert([northLink('converted', 'csv', converted), northLink('empty', 'jsonToCsv', null)]);

    await up(db);
    await up(db);

    assert.deepStrictEqual(await linkOf('north_transformers', 'converted'), { transformerId: 'csv', options: converted });
    assert.deepStrictEqual((await linkOf('north_transformers', 'empty')).options, {
      input: { fileType: 'json', rowIteratorPath: '$[*]' },
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
      filename: '@CurrentDate.csv',
      keepOtherFields: false,
      fields: []
    });
  });

  it('should not revert', async () => {
    await down();
  });
});
