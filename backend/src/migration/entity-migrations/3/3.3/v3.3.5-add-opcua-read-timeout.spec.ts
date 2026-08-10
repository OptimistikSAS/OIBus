import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.3.5-add-opcua-read-timeout';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({
    id,
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *'
  });
}

async function insertSouthConnector(db: Knex, id: string, type: string, settings: unknown) {
  await db('south_connectors').insert({
    id,
    name: `Test ${type} ${id}`,
    type,
    description: '',
    enabled: 1,
    settings: JSON.stringify(settings),
    history_max_instant_per_item: 0,
    history_max_read_interval: 3600,
    history_read_delay: 200,
    history_read_overlap: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertHistoryQuery(db: Knex, id: string, southType: string, southSettings: unknown, scanModeId: string) {
  await db('history_queries').insert({
    id,
    status: 'PENDING',
    name: `History ${id}`,
    description: '',
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: southType,
    north_type: 'file-writer',
    south_settings: JSON.stringify(southSettings),
    north_settings: JSON.stringify({}),
    history_max_instant_per_item: 0,
    history_max_read_interval: 3600,
    history_read_delay: 200,
    caching_scan_mode_id: scanModeId,
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

const OLD_OPCUA_SETTINGS = {
  url: 'opc.tcp://localhost:4840',
  keepSessionAlive: false,
  retryInterval: 10000,
  securityMode: 'none',
  securityPolicy: 'none',
  authentication: { type: 'none' }
};

describe('Entity migration v3.3.5-add-opcua-read-timeout', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.3.5-add-opcua-read-timeout.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await insertScanMode(db);
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.3.5 schema', async () => {
    await up(db); // must not throw
  });

  it('adds readTimeout to an opcua south connector settings, preserving old fields', async () => {
    await insertSouthConnector(db, 'opcua-1', 'opcua', OLD_OPCUA_SETTINGS);

    await up(db);

    const row = await db('south_connectors').where('id', 'opcua-1').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.url, OLD_OPCUA_SETTINGS.url, 'existing settings preserved');
    assert.strictEqual(settings.readTimeout, 15000);
  });

  it('does not touch settings of south connectors of other types', async () => {
    const oldSettings = { inputFolder: 'input', compression: false };
    await insertSouthConnector(db, 'folder-scanner-1', 'folder-scanner', oldSettings);

    await up(db);

    const row = await db('south_connectors').where('id', 'folder-scanner-1').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, oldSettings, 'non opcua settings are left untouched');
  });

  it('adds readTimeout to a history query with an opcua south, preserving old fields', async () => {
    await insertHistoryQuery(db, 'history-opcua-1', 'opcua', OLD_OPCUA_SETTINGS, 'scan-mode-1');

    await up(db);

    const row = await db('history_queries').where('id', 'history-opcua-1').first();
    const settings = JSON.parse(row.south_settings);
    assert.strictEqual(settings.url, OLD_OPCUA_SETTINGS.url, 'existing settings preserved');
    assert.strictEqual(settings.readTimeout, 15000);
  });

  it('does not touch south_settings of history queries with a different south type', async () => {
    const oldSettings = { inputFolder: 'input', compression: false };
    await insertHistoryQuery(db, 'history-folder-1', 'folder-scanner', oldSettings, 'scan-mode-1');

    await up(db);

    const row = await db('history_queries').where('id', 'history-folder-1').first();
    const settings = JSON.parse(row.south_settings);
    assert.deepStrictEqual(settings, oldSettings, 'non opcua history query settings are left untouched');
  });

  it('down is a no-op', async () => {
    await insertSouthConnector(db, 'opcua-2', 'opcua', OLD_OPCUA_SETTINGS);
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'opcua-2').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.readTimeout, 15000, 'down does not revert the up() migration');
  });
});
