import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_8';

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

describe('Entity migration v3.10.0_8', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_8.ts', db)
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
      south_type: 'folder-scanner',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'mqtt', type: 'standard', function_name: 'csv-to-mqtt', input_type: 'file', output_type: 'mqtt' },
      { id: 'records', type: 'standard', function_name: 'csv-to-record-list', input_type: 'file', output_type: 'record-list' },
      { id: 'oia', type: 'standard', function_name: 'json-to-oianalytics', input_type: 'file', output_type: 'oianalytics' },
      { id: 'existing', type: 'standard', function_name: 'file-to-record-list', input_type: 'file', output_type: 'record-list' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should replace the CSV and JSON transformers by the file ones, converting their options', async () => {
    await db('north_transformers').insert([
      northLink('mqtt', 'mqtt', {
        delimiter: 'COMMA',
        hasHeader: false,
        topicColumn: '0',
        payloadType: 'object',
        valueColumn: null,
        objectFields: [{ key: 'temp', column: '1', dataType: 'number' }]
      }),
      northLink('records', 'records', { delimiter: 'TAB', hasHeader: true, pointIdColumn: 'id' }),
      northLink('empty', 'records', null)
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'oia',
      options: JSON.stringify({
        rowIteratorPath: '$.rows[*]',
        pointId: '$.rows[*].name',
        value: '$.rows[*].value',
        timestamp: '$.rows[*].time',
        referenceProcess: 'value.trim()',
        datetimeSettings: {
          inputType: 'string',
          inputTimezone: 'Europe/Paris',
          inputFormat: 'dd/MM/yyyy',
          inputLocale: 'fr-FR',
          outputPrecision: 's'
        }
      })
    });

    await up(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name').orderBy('id'), [
      { id: 'existing', function_name: 'file-to-record-list' },
      { id: 'mqtt', function_name: 'file-to-mqtt' },
      { id: 'oia', function_name: 'file-to-oianalytics' }
    ]);
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), {
      transformerId: 'mqtt',
      options: {
        input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: false },
        topicField: '0',
        payloadType: 'object',
        valueField: null,
        objectFields: [{ key: 'temp', field: '1', dataType: 'number' }]
      }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'records'), {
      transformerId: 'existing',
      options: { input: { fileType: 'csv', delimiter: 'TAB', hasHeader: true } }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'empty'), {
      transformerId: 'existing',
      options: { input: { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true } }
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'history'), {
      transformerId: 'oia',
      options: {
        input: { fileType: 'json', rowIteratorPath: '$.rows[*]' },
        reference: { referenceField: '$.rows[*].name', referenceProcess: 'value.trim()' },
        timestamp: {
          timestampField: '$.rows[*].time',
          sourceType: 'string',
          precision: 's',
          timezone: 'Europe/Paris',
          format: 'dd/MM/yyyy',
          locale: 'fr-FR'
        },
        value: { valueField: '$.rows[*].value', valueProcess: null }
      }
    });
  });

  it('should keep the options already converted, and do nothing without CSV or JSON transformer', async () => {
    const converted = {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      topicField: 'topic',
      payloadType: 'string',
      valueField: 'v'
    };
    await db('north_transformers').insert(northLink('mqtt', 'mqtt', converted));

    await up(db);
    await up(db);

    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), { transformerId: 'mqtt', options: converted });
  });

  it('should not revert', async () => {
    await down();
  });
});
