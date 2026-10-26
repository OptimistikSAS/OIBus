import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_10';

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

describe('Entity migration v3.10.0_10', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_10.ts', db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const northLink = (id: string, northId: string, transformerId: string, options: object | null) => ({
    id,
    north_id: northId,
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
    await db('north_connectors').insert([
      { ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' },
      { ...caching, id: 'console', name: 'Console', type: 'console', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'folder-scanner',
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').del();
    await db('transformers').insert([
      { id: 'records', type: 'standard', function_name: 'file-to-record-list', input_type: 'file', output_type: 'record-list' },
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'customRecords', type: 'custom', name: 'Records', input_type: 'file', output_type: 'record-list' },
      { id: 'customSetpoints', type: 'custom', name: 'Setpoints', input_type: 'setpoint', output_type: 'setpoint' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should only send files to the File Writer Norths', async () => {
    const input = { fileType: 'json', rowIteratorPath: '$.rows[*]' };
    await db('north_transformers').insert([
      northLink('records', 'writer', 'records', { input }),
      northLink('file', 'writer', 'file', {}),
      northLink('custom', 'writer', 'customRecords', {}),
      northLink('setpoints', 'writer', 'customSetpoints', null),
      northLink('console', 'console', 'records', { input })
    ]);
    await db('history_query_transformers').insert([
      { id: 'historyRecords', history_id: 'hq1', transformer_id: 'records', options: null },
      { id: 'historyCustom', history_id: 'hq1', transformer_id: 'customRecords', options: null }
    ]);

    await up(db);

    const fileToFile = await db('transformers').where('function_name', 'file-to-file').first('id', 'input_type', 'output_type');
    assert.deepStrictEqual({ ...fileToFile, id: undefined }, { id: undefined, input_type: 'file', output_type: 'file' });
    const fileOptions = (fileInput: object) => ({
      input: fileInput,
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: '@CurrentDate.json',
      keepOtherFields: true,
      fields: []
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'records'), { transformerId: fileToFile.id, options: fileOptions(input) });
    assert.deepStrictEqual(
      (await db('north_transformers').select('id').orderBy('id')).map(link => link.id),
      ['console', 'file', 'records']
    );
    assert.deepStrictEqual(await linkOf('north_transformers', 'console'), { transformerId: 'records', options: { input } });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'historyRecords'), {
      transformerId: fileToFile.id,
      options: fileOptions({ fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true })
    });
    assert.deepStrictEqual(await db('history_query_transformers').select('id'), [{ id: 'historyRecords' }]);
  });

  it('should reuse the file-to-file transformer, and do nothing without transformer sending records or setpoints', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'file-to-file',
      input_type: 'file',
      output_type: 'file'
    });
    await db('north_transformers').insert(northLink('records', 'writer', 'records', null));

    await up(db);

    assert.strictEqual((await linkOf('north_transformers', 'records')).transformerId, 'existing');

    await db('transformers').whereIn('id', ['records', 'customRecords', 'customSetpoints']).del();
    await up(db);
  });

  it('should not revert', async () => {
    await down();
  });
});
