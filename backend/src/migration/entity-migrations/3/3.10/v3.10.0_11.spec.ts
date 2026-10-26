import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { toOIAnalyticsItemFileOptions } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_11';

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

const serialization = (filename: string) => ({
  type: 'csv',
  filename,
  delimiter: 'SEMI_COLON',
  compression: true,
  outputTimestampFormat: 'yyyy-MM-dd',
  outputTimezone: 'Europe/Paris'
});
const itemSettings = (filename: string) => JSON.stringify({ endpoint: '/api', queryParams: [], serialization: serialization(filename) });

describe('Entity migration v3.10.0_11', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_11.ts', db)
  });
  let db: Knex;
  const settingsOf = async (table: string, id: string) => JSON.parse((await db(table).where('id', id).first('settings')).settings);

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'oia', name: 'OIA', type: 'oianalytics', enabled: true, settings: '{}' },
      { id: 'folder', name: 'Folder', type: 'folder-scanner', enabled: true, settings: '{}' }
    ]);
    const item = (id: string, southId: string, settings: string) => ({
      id,
      connector_id: southId,
      scan_mode_id: 'sm1',
      name: id,
      enabled: true,
      settings
    });
    await db('south_items').insert([
      item('i1', 'oia', itemSettings('i1.csv')),
      item('i2', 'oia', itemSettings('i2.csv')),
      item('i3', 'oia', itemSettings('i3.csv')),
      item('f1', 'folder', '{}')
    ]);
    await db('south_item_groups').insert({ id: 'g1', created_at: NOW, updated_at: NOW, name: 'G1', south_id: 'oia', scan_mode_id: 'sm1' });
    await db('group_items').insert({ group_id: 'g1', item_id: 'i2' });
    await db('north_connectors').insert([
      { ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' },
      { ...caching, id: 'mqttNorth', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq',
      name: 'HQ',
      start_time: NOW,
      end_time: NOW,
      south_type: 'oianalytics',
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('history_items').insert([
      { id: 'h1', history_id: 'hq', name: 'h1', enabled: true, settings: itemSettings('h1.csv') },
      { id: 'h2', history_id: 'hq', name: 'h2', enabled: true, settings: itemSettings('h2.csv') }
    ]);
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'fileToMqtt', type: 'standard', function_name: 'file-to-mqtt', input_type: 'file', output_type: 'mqtt' }
    ]);
  });

  afterEach(() => harness.afterEach());

  const southLink = (id: string, northId: string, transformerId: string, southId: string, groupId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{}',
    source_type: 'south',
    source_south_south_id: southId,
    source_south_group_id: groupId
  });

  it('should write the CSV files of the South OIAnalytics items sent as they are through record-list-to-file', async () => {
    await db('north_transformers').insert([
      // i2 is sent as is through its group, i1 is left out of the South level link, i3 is sent as is
      southLink('group', 'writer', 'file', 'oia', 'g1'),
      southLink('south', 'writer', 'file', 'oia'),
      southLink('mqtt', 'mqttNorth', 'fileToMqtt', 'oia'),
      southLink('folder', 'writer', 'file', 'folder')
    ]);
    await db('north_transformers_items').insert({ id: 'south', item_id: 'i1', excluded: true });
    await db('history_query_transformers').insert([
      { id: 'hItem', history_id: 'hq', transformer_id: 'fileToMqtt', options: '{}' },
      { id: 'hAll', history_id: 'hq', transformer_id: 'file', options: '{}' }
    ]);
    await db('history_query_transformers_items').insert({ id: 'hItem', item_id: 'h1' });

    await up(db);

    const recordListToFile = await db('transformers').where('function_name', 'record-list-to-file').first('id');
    const northLinks = await db('north_transformers').select('id', 'north_id', 'transformer_id', 'options').orderBy('rowid');
    assert.deepStrictEqual(
      northLinks.filter(link => link.transformer_id !== recordListToFile.id).map(link => link.id),
      ['folder']
    );
    const added = northLinks.filter(link => link.transformer_id === recordListToFile.id);
    const itemsOf = async (table: string, id: string) => (await db(table).where('id', id).select('item_id')).map(row => row.item_id);
    assert.deepStrictEqual(
      await Promise.all(added.map(async link => [link.north_id, await itemsOf('north_transformers_items', link.id)])),
      [
        ['writer', ['i2']],
        ['writer', ['i3']]
      ]
    );
    assert.deepStrictEqual(JSON.parse(added[0].options), toOIAnalyticsItemFileOptions(serialization('i2.csv')));
    assert.deepStrictEqual(await settingsOf('south_items', 'i1'), { endpoint: '/api', queryParams: [] });
    assert.deepStrictEqual(await settingsOf('south_items', 'f1'), {});

    const historyLinks = await db('history_query_transformers').select('id', 'transformer_id', 'options');
    assert.deepStrictEqual(historyLinks.length, 1);
    assert.strictEqual(historyLinks[0].transformer_id, recordListToFile.id);
    assert.deepStrictEqual(await itemsOf('history_query_transformers_items', historyLinks[0].id), ['h2']);
    assert.deepStrictEqual(JSON.parse(historyLinks[0].options), toOIAnalyticsItemFileOptions(serialization('h2.csv')));
    assert.deepStrictEqual(await settingsOf('history_items', 'h1'), { endpoint: '/api', queryParams: [] });
  });

  it('should reuse the record-list-to-file transformer, and do nothing once the items are converted', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'record-list-to-file',
      input_type: 'record-list',
      output_type: 'file'
    });
    await db('north_transformers').insert(southLink('south', 'writer', 'file', 'oia'));

    await up(db);
    const linksAfterFirstRun = await db('north_transformers').select('id', 'transformer_id');
    await up(db);

    assert.deepStrictEqual(await db('north_transformers').select('id', 'transformer_id'), linksAfterFirstRun);
    assert.deepStrictEqual(
      linksAfterFirstRun.map(link => link.transformer_id),
      ['existing', 'existing', 'existing']
    );
  });

  it('should do nothing without South OIAnalytics', async () => {
    await db('history_queries').update({ south_type: 'folder-scanner' });
    await db('south_connectors').where('type', 'oianalytics').update({ type: 'folder-scanner' });

    await up(db);
  });

  it('should not revert', async () => {
    await down();
  });
});
