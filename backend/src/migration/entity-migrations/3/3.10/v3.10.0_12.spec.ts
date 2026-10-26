import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { COMPRESSED_FILE_OPTIONS } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_12';

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

describe('Entity migration v3.10.0_12', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_12.ts', db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const southLink = (id: string, southId: string, transformerId: string) => ({
    id,
    north_id: 'writer',
    transformer_id: transformerId,
    options: '{}',
    source_type: 'south',
    source_south_south_id: southId
  });
  const historyQuery = (id: string, compression: boolean) => ({
    ...caching,
    id,
    name: id,
    start_time: NOW,
    end_time: NOW,
    south_type: 'sftp',
    north_type: 'file-writer',
    south_settings: JSON.stringify({ host: 'h', compression }),
    north_settings: '{}'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'compressed', name: 'Compressed', type: 'folder-scanner', enabled: true, settings: '{"inputFolder":"in","compression":true}' },
      { id: 'raw', name: 'Raw', type: 'ftp', enabled: true, settings: '{"host":"h","compression":false}' },
      { id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{"compression":true}' }
    ]);
    await db('north_connectors').insert({ ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' });
    await db('history_queries').insert([historyQuery('hqCompressed', true), historyQuery('hqRaw', false)]);
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'fileToOia', type: 'standard', function_name: 'file-to-oianalytics', input_type: 'file', output_type: 'oianalytics' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should compress the files of the compressing Souths in file-to-file transformers', async () => {
    await db('north_transformers').insert([
      southLink('compressed', 'compressed', 'file'),
      southLink('converted', 'compressed', 'fileToOia'),
      southLink('raw', 'raw', 'file'),
      southLink('mqtt', 'mqtt', 'file')
    ]);
    await db('history_query_transformers').insert([
      { id: 'hCompressed', history_id: 'hqCompressed', transformer_id: 'file', options: '{}' },
      { id: 'hRaw', history_id: 'hqRaw', transformer_id: 'file', options: '{}' }
    ]);

    await up(db);

    const fileToFile = await db('transformers').where('function_name', 'file-to-file').first('id');
    assert.deepStrictEqual(await linkOf('north_transformers', 'compressed'), {
      transformerId: fileToFile.id,
      options: COMPRESSED_FILE_OPTIONS
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'converted'), { transformerId: 'fileToOia', options: {} });
    assert.deepStrictEqual(await linkOf('north_transformers', 'raw'), { transformerId: 'file', options: {} });
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), { transformerId: 'file', options: {} });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'hCompressed'), {
      transformerId: fileToFile.id,
      options: COMPRESSED_FILE_OPTIONS
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'hRaw'), { transformerId: 'file', options: {} });

    const settingsOf = async (table: string, column: string, id: string) =>
      JSON.parse((await db(table).where('id', id).first(column))[column]);
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'compressed'), { inputFolder: 'in' });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'raw'), { host: 'h' });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'mqtt'), { compression: true });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hqCompressed'), { host: 'h' });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hqRaw'), { host: 'h' });
  });

  it('should reuse the file-to-file transformer, and do nothing once the settings are removed', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'file-to-file',
      input_type: 'file',
      output_type: 'file'
    });
    await db('north_transformers').insert(southLink('compressed', 'compressed', 'file'));

    await up(db);
    await up(db);

    assert.strictEqual((await linkOf('north_transformers', 'compressed')).transformerId, 'existing');
  });

  it('should only remove the setting without file transformer', async () => {
    await db('transformers').where('id', 'file').del();

    await up(db);

    assert.deepStrictEqual(JSON.parse((await db('south_connectors').where('id', 'compressed').first('settings')).settings), {
      inputFolder: 'in'
    });
  });

  it('should not revert', async () => {
    await down();
  });
});
