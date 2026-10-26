import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_6';

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

const oldOptions = {
  pointIdColumn: 'reference',
  timestampColumn: 'time',
  valueColumn: 'measure',
  timestampSettings: { type: 'string', timezone: 'Europe/Paris', format: 'dd/MM/yyyy HH:mm', locale: 'fr-FR' },
  precision: 's',
  referenceProcess: 'value.toUpperCase()'
};
const groupedOptions = {
  reference: { referenceField: 'reference', referenceProcess: 'value.toUpperCase()' },
  timestamp: {
    timestampField: 'time',
    sourceType: 'string',
    precision: 's',
    timezone: 'Europe/Paris',
    format: 'dd/MM/yyyy HH:mm',
    locale: 'fr-FR'
  },
  value: { valueField: 'measure', valueProcess: null }
};

describe('Entity migration v3.10.0_6', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_6.ts', db)
  });
  let db: Knex;
  const optionsOf = async (table: string, id: string) => JSON.parse((await db(table).where('id', id).first('options')).options);

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
      south_type: 'opcua',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'oia', type: 'standard', function_name: 'record-list-to-oianalytics', input_type: 'record-list', output_type: 'oianalytics' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should group the options of the OIAnalytics transformers by reference, timestamp and value', async () => {
    const link = (id: string, transformerId: string, options: object | null) => ({
      id,
      north_id: 'north1',
      transformer_id: transformerId,
      options: options ? JSON.stringify(options) : null,
      source_type: 'oianalytics-setpoint'
    });
    await db('north_transformers').insert([
      link('old', 'oia', oldOptions),
      link('grouped', 'oia', groupedOptions),
      link('empty', 'oia', null),
      link('other', 'json', { pointIdColumn: 'kept' })
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'oia',
      options: JSON.stringify({ ...oldOptions, timestampSettings: { type: 'unix-epoch-ms' }, referenceProcess: null })
    });

    await up(db);

    assert.deepStrictEqual(await optionsOf('north_transformers', 'old'), groupedOptions);
    assert.deepStrictEqual(await optionsOf('north_transformers', 'grouped'), groupedOptions);
    assert.deepStrictEqual(await optionsOf('north_transformers', 'empty'), {
      reference: { referenceField: 'pointId', referenceProcess: null },
      timestamp: { timestampField: 'timestamp', sourceType: 'iso-string', precision: 'ms' },
      value: { valueField: 'value', valueProcess: null }
    });
    assert.deepStrictEqual(await optionsOf('north_transformers', 'other'), { pointIdColumn: 'kept' });
    assert.deepStrictEqual(await optionsOf('history_query_transformers', 'history'), {
      reference: { referenceField: 'reference', referenceProcess: null },
      timestamp: { timestampField: 'time', sourceType: 'unix-epoch-ms', precision: 's' },
      value: { valueField: 'measure', valueProcess: null }
    });
  });

  it('should do nothing without OIAnalytics transformer', async () => {
    await db('transformers').where('id', 'oia').del();

    await up(db);
  });

  it('should not revert', async () => {
    await down();
  });
});
