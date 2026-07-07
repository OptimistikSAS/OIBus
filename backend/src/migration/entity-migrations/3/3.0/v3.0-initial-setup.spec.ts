import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { up, down } from './v3.0-initial-setup';

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.0-initial-setup', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v30-'));
    dbFile = path.join(tmpDir, 'test.db');
  });

  after(async () => {
    await db?.destroy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await db?.destroy();
    await fs.rm(dbFile, { force: true });
    db = knex({ client: 'better-sqlite3', connection: { filename: dbFile }, useNullAsDefault: true });
  });

  it('creates all expected tables', async () => {
    await up(db);

    for (const table of [
      'engines',
      'users',
      'external_sources',
      'ip_filters',
      'scan_modes',
      'history_queries',
      'history_items',
      'south_connectors',
      'south_items',
      'north_connectors',
      'subscription',
      'external_subscription'
    ]) {
      assert.ok(await db.schema.hasTable(table), `table ${table} created`);
    }
  });

  it('creates the engines table with expected columns and defaults', async () => {
    await up(db);
    const cols = await columnNames(db, 'engines');
    assert.ok(cols.includes('name'));
    assert.ok(cols.includes('port'));
    assert.ok(cols.includes('log_console_level'));
    assert.ok(cols.includes('log_loki_token_address'));

    await db('engines').insert({ id: 'engine-1' });
    const row = await db('engines').where('id', 'engine-1').first();
    assert.strictEqual(row.name, 'OIBus');
    assert.strictEqual(row.port, 2223);
    assert.strictEqual(row.log_console_level, 'silent');
    assert.strictEqual(row.log_file_max_file_size, 50);
    assert.strictEqual(row.log_database_max_number_of_logs, 100000);
    assert.strictEqual(row.log_loki_address, null);
  });

  it('creates the users table with expected columns', async () => {
    await up(db);
    const cols = await columnNames(db, 'users');
    assert.deepStrictEqual(
      cols.sort(),
      ['id', 'created_at', 'updated_at', 'login', 'password', 'first_name', 'last_name', 'email', 'language', 'timezone'].sort()
    );

    await db('users').insert({ id: 'user-1', login: 'admin', password: 'secret' });
    const row = await db('users').where('id', 'user-1').first();
    assert.strictEqual(row.login, 'admin');
  });

  it('creates the external_sources table with a unique reference', async () => {
    await up(db);
    const cols = await columnNames(db, 'external_sources');
    assert.ok(cols.includes('reference'));
    assert.ok(cols.includes('description'));
  });

  it('creates the ip_filters table with a unique address', async () => {
    await up(db);
    const cols = await columnNames(db, 'ip_filters');
    assert.ok(cols.includes('address'));
    assert.ok(cols.includes('description'));
  });

  it('creates the scan_modes table without timestamps', async () => {
    await up(db);
    const cols = await columnNames(db, 'scan_modes');
    assert.deepStrictEqual(cols.sort(), ['id', 'name', 'description', 'cron'].sort());
  });

  it('creates the history_queries table with caching columns referencing scan_modes', async () => {
    await up(db);
    const cols = await columnNames(db, 'history_queries');
    for (const col of [
      'id',
      'name',
      'description',
      'enabled',
      'start_time',
      'end_time',
      'south_type',
      'north_type',
      'south_settings',
      'north_settings',
      'history_max_instant_per_item',
      'history_max_read_interval',
      'history_read_delay',
      'caching_scan_mode_id',
      'caching_group_count',
      'caching_retry_interval',
      'caching_retry_count',
      'caching_max_send_count',
      'caching_send_file_immediately',
      'caching_max_size',
      'archive_enabled',
      'archive_retention_duration'
    ]) {
      assert.ok(cols.includes(col), `history_queries.${col} exists`);
    }
  });

  it('creates the history_items table referencing history_queries', async () => {
    await up(db);
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', cron: '*/10 * * * * *' });
    await db('history_queries').insert({
      id: 'history-1',
      name: 'History A',
      enabled: true,
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-02T00:00:00Z',
      south_type: 'mssql',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}',
      history_max_instant_per_item: 1,
      history_max_read_interval: 3600,
      history_read_delay: 200,
      caching_scan_mode_id: 'scan-mode-1',
      caching_group_count: 1000,
      caching_retry_interval: 5000,
      caching_retry_count: 3,
      caching_max_send_count: 1000,
      caching_send_file_immediately: 1,
      caching_max_size: 30,
      archive_enabled: 0,
      archive_retention_duration: 720
    });
    await db('history_items').insert({
      id: 'history-item-1',
      history_id: 'history-1',
      name: 'Item A',
      enabled: true,
      settings: '{}'
    });

    const item = await db('history_items').where('id', 'history-item-1').first();
    assert.strictEqual(item.history_id, 'history-1');
  });

  it('creates the south_connectors table with expected columns', async () => {
    await up(db);
    const cols = await columnNames(db, 'south_connectors');
    for (const col of [
      'id',
      'name',
      'type',
      'description',
      'enabled',
      'settings',
      'history_max_instant_per_item',
      'history_max_read_interval',
      'history_read_delay'
    ]) {
      assert.ok(cols.includes(col), `south_connectors.${col} exists`);
    }
  });

  it('creates the south_items table referencing south_connectors and scan_modes', async () => {
    await up(db);
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', cron: '*/10 * * * * *' });
    await db('south_connectors').insert({
      id: 'south-1',
      name: 'South A',
      type: 'mssql',
      enabled: true,
      settings: '{}',
      history_max_instant_per_item: 1,
      history_max_read_interval: 3600,
      history_read_delay: 200
    });
    await db('south_items').insert({
      id: 'south-item-1',
      connector_id: 'south-1',
      scan_mode_id: 'scan-mode-1',
      name: 'Item A',
      enabled: true,
      settings: '{}'
    });

    const item = await db('south_items').where('id', 'south-item-1').first();
    assert.strictEqual(item.connector_id, 'south-1');
    assert.strictEqual(item.scan_mode_id, 'scan-mode-1');
  });

  it('creates the north_connectors table with expected columns', async () => {
    await up(db);
    const cols = await columnNames(db, 'north_connectors');
    for (const col of [
      'id',
      'name',
      'type',
      'description',
      'enabled',
      'settings',
      'caching_scan_mode_id',
      'caching_group_count',
      'caching_retry_interval',
      'caching_retry_count',
      'caching_max_send_count',
      'caching_send_file_immediately',
      'caching_max_size',
      'archive_enabled',
      'archive_retention_duration'
    ]) {
      assert.ok(cols.includes(col), `north_connectors.${col} exists`);
    }
  });

  it('creates the subscription table with a composite primary key', async () => {
    await up(db);
    const info = (await db.raw('PRAGMA table_info(subscription)')) as Array<{ name: string; pk: number }>;
    const pkCols = info.filter(c => c.pk > 0).map(c => c.name);
    assert.deepStrictEqual(pkCols.sort(), ['north_connector_id', 'south_connector_id']);
  });

  it('creates the external_subscription table with a composite primary key', async () => {
    await up(db);
    const info = (await db.raw('PRAGMA table_info(external_subscription)')) as Array<{ name: string; pk: number }>;
    const pkCols = info.filter(c => c.pk > 0).map(c => c.name);
    assert.deepStrictEqual(pkCols.sort(), ['external_source_id', 'north_connector_id']);
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    assert.ok(await db.schema.hasTable('engines'), 'tables are left untouched by down');
  });
});
