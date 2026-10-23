import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_5';

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

describe('Entity migration v3.10.0_5', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_5.ts', db)
  });
  let db: Knex;

  const southLink = (id: string, northId: string, transformerId: string, southId: string, groupId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{"kept":true}',
    source_type: 'south',
    source_api_data_source_id: null,
    source_south_south_id: southId,
    source_south_group_id: groupId
  });
  const sourceLink = (id: string, northId: string, transformerId: string, sourceType: string, dataSourceId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{}',
    source_type: sourceType,
    source_api_data_source_id: dataSourceId,
    source_south_south_id: null,
    source_south_group_id: null
  });

  /** The links of a North, described by their transformer, source and items */
  const northLinks = async (northId: string) => {
    const links = await db('north_transformers as nt')
      .join('transformers as t', 't.id', 'nt.transformer_id')
      .select(
        'nt.id',
        't.function_name',
        't.name',
        'nt.options',
        'nt.source_type',
        'nt.source_api_data_source_id',
        'nt.source_south_south_id',
        'nt.source_south_group_id'
      )
      .where('nt.north_id', northId);
    const result = [];
    for (const link of links) {
      const itemRows = await db('north_transformers_items').where('id', link.id).whereNotNull('item_id').orderBy('item_id');
      result.push({
        transformer: link.function_name ?? link.name,
        options: JSON.parse(link.options),
        source: link.source_south_south_id ?? link.source_api_data_source_id ?? link.source_type,
        group: link.source_south_group_id,
        items: itemRows.filter(row => !row.excluded).map(row => row.item_id),
        excludedItems: itemRows.filter(row => row.excluded).map(row => row.item_id)
      });
    }
    return result.sort((a, b) => `${a.source}${a.transformer}`.localeCompare(`${b.source}${b.transformer}`));
  };
  const historyLinks = async (historyId: string) => {
    const links = await db('history_query_transformers as ht')
      .join('transformers as t', 't.id', 'ht.transformer_id')
      .select('ht.id', 't.function_name')
      .where('ht.history_id', historyId);
    const result = [];
    for (const link of links) {
      const items = await db('history_query_transformers_items').where('id', link.id).orderBy('item_id').pluck('item_id');
      result.push({ transformer: link.function_name, items });
    }
    return result;
  };

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'opcua', name: 'OPC UA', type: 'opcua', enabled: true, settings: '{}' },
      { id: 'folder', name: 'Folder', type: 'folder-scanner', enabled: true, settings: '{}' },
      { id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    const item = (id: string, southId: string) => ({
      id,
      connector_id: southId,
      scan_mode_id: 'sm1',
      name: id,
      enabled: true,
      settings: '{}'
    });
    await db('south_items').insert([
      item('i1', 'opcua'),
      item('i2', 'opcua'),
      item('i3', 'opcua'),
      item('f1', 'folder'),
      item('m1', 'mqtt')
    ]);
    await db('south_item_groups').insert({
      id: 'g1',
      created_at: NOW,
      updated_at: NOW,
      name: 'Group 1',
      south_id: 'opcua',
      scan_mode_id: 'sm1'
    });
    await db('group_items').insert([
      { group_id: 'g1', item_id: 'i1' },
      { group_id: 'g1', item_id: 'i2' }
    ]);
    await db('north_connectors').insert([
      { ...caching, id: 'console', name: 'Console', type: 'console', enabled: true, settings: '{}' },
      { ...caching, id: 's3', name: 'S3', type: 'aws-s3', enabled: true, settings: '{}' },
      { ...caching, id: 'mqttNorth', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    const historyQuery = (id: string, southType: string, northType: string) => ({
      ...caching,
      id,
      name: id,
      start_time: NOW,
      end_time: NOW,
      south_type: southType,
      north_type: northType,
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('history_queries').insert([historyQuery('hqConsole', 'opcua', 'console'), historyQuery('hqS3', 'mssql', 'aws-s3')]);
    await db('history_items').insert([
      { id: 'h1', history_id: 'hqConsole', name: 'h1', enabled: true, settings: '{}' },
      { id: 'h2', history_id: 'hqConsole', name: 'h2', enabled: true, settings: '{}' },
      { id: 'h3', history_id: 'hqS3', name: 'h3', enabled: true, settings: '{}' }
    ]);
    // Replace the standard transformers seeded by the previous migrations with known ids
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'iso', type: 'standard', function_name: 'iso', input_type: 'any', output_type: 'any' },
      { id: 'ignore', type: 'standard', function_name: 'ignore', input_type: 'any', output_type: 'any' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' },
      { id: 'csv', type: 'standard', function_name: 'record-list-to-csv', input_type: 'record-list', output_type: 'any' },
      { id: 'custom', type: 'custom', input_type: 'any', output_type: 'any', name: 'custom', custom_code: '', language: 'javascript' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should add the passthroughs of the data the North received without transformer, and remove iso and ignore', async () => {
    await up(db);

    const columns = await db('north_transformers_items').columnInfo();
    assert.strictEqual(columns.excluded.defaultValue, "'0'");
    assert.strictEqual(columns.excluded.nullable, false);

    assert.deepStrictEqual(await northLinks('console'), [
      { transformer: 'file', options: {}, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'setpoint-to-json', options: {}, source: 'oianalytics-setpoint', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] },
      { transformer: 'record-list-to-json', options: {}, source: 'opcua', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(await northLinks('s3'), [
      { transformer: 'file', options: {}, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(await northLinks('mqttNorth'), []);
    assert.deepStrictEqual(await historyLinks('hqConsole'), [{ transformer: 'record-list-to-json', items: [] }]);
    assert.deepStrictEqual(await historyLinks('hqS3'), []);
    assert.deepStrictEqual(await db('transformers').where('type', 'standard').orderBy('function_name').pluck('function_name'), [
      'file',
      'record-list-to-csv',
      'record-list-to-json',
      'setpoint-to-json'
    ]);
    assert.deepStrictEqual(await db('transformers').where('function_name', 'file').first('input_type', 'output_type', 'created_by'), {
      input_type: 'any',
      output_type: 'any',
      created_by: 'system'
    });
  });

  it('should leave the ignored items out of the transformers they fall back to', async () => {
    await db('north_transformers').insert([
      southLink('ignoreI2', 'console', 'ignore', 'opcua'),
      southLink('groupCsv', 'console', 'csv', 'opcua', 'g1'),
      southLink('ignoreFolder', 'console', 'ignore', 'folder')
    ]);
    await db('north_transformers_items').insert([
      { id: 'ignoreI2', item_id: 'i2' },
      { id: 'groupCsv', group_id: 'g1' }
    ]);

    await up(db);

    assert.deepStrictEqual(await northLinks('console'), [
      { transformer: 'setpoint-to-json', options: {}, source: 'oianalytics-setpoint', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] },
      { transformer: 'record-list-to-csv', options: { kept: true }, source: 'opcua', group: 'g1', items: [], excludedItems: ['i2'] },
      { transformer: 'record-list-to-json', options: {}, source: 'opcua', group: null, items: [], excludedItems: ['i2'] }
    ]);
    assert.ok(await db('north_transformers_items').where('id', 'groupCsv').whereNotNull('group_id').first());
  });

  it('should replace iso by the passthrough the North accepts, and drop the ignored sources', async () => {
    await db('north_transformers').insert([
      southLink('isoMqtt', 's3', 'iso', 'mqtt'),
      southLink('isoOpcua', 's3', 'iso', 'opcua'),
      southLink('customFolder', 's3', 'custom', 'folder'),
      sourceLink('isoApi', 's3', 'iso', 'oibus-api', 'ds1'),
      sourceLink('ignoreApi', 's3', 'ignore', 'oibus-api', 'ds2'),
      sourceLink('ignoreSetpoints', 'console', 'ignore', 'oianalytics-setpoint'),
      sourceLink('isoSetpoints', 'mqttNorth', 'iso', 'oianalytics-setpoint')
    ]);

    await up(db);

    assert.deepStrictEqual(await northLinks('s3'), [
      { transformer: 'file', options: {}, source: 'ds1', group: null, items: [], excludedItems: [] },
      { transformer: 'custom', options: { kept: true }, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'mqtt', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(
      (await northLinks('console')).filter(link => link.source === 'oianalytics-setpoint'),
      []
    );
    assert.deepStrictEqual(await northLinks('mqttNorth'), []);
  });

  it('should keep routing the items of history queries as before', async () => {
    await db('history_query_transformers').insert([
      { id: 'ignoreH1', history_id: 'hqConsole', transformer_id: 'ignore', options: '{}' },
      { id: 'isoS3', history_id: 'hqS3', transformer_id: 'iso', options: '{}' }
    ]);
    await db('history_query_transformers_items').insert({ id: 'ignoreH1', item_id: 'h1' });

    await up(db);

    assert.deepStrictEqual(await historyLinks('hqConsole'), [{ transformer: 'record-list-to-json', items: ['h2'] }]);
    assert.deepStrictEqual(await historyLinks('hqS3'), []);
  });

  it('should reuse the existing passthroughs, and drop the links of deleted souths', async () => {
    await db('transformers').insert({ id: 'file', type: 'standard', function_name: 'file', input_type: 'any', output_type: 'any' });
    await db('north_transformers').insert({ ...southLink('orphan', 'mqttNorth', 'iso', 'opcua'), source_south_south_id: null });

    await up(db);

    assert.deepStrictEqual(
      (await northLinks('s3')).map(link => link.transformer),
      ['file', 'file']
    );
    assert.strictEqual(
      await db('north_transformers')
        .where('transformer_id', 'file')
        .count({ count: '*' })
        .first()
        .then(row => row?.count),
      4
    );
    assert.strictEqual(await db('north_transformers').where('id', 'orphan').first(), undefined);
  });

  it('should not revert', async () => {
    await down();
  });
});
