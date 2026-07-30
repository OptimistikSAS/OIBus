import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { down, up } from './v3.9.0_1';

/** Build the schema as it exists just before v3.9.0_1 by running every prior entity migration in order. */
async function buildPreV3901Schema(db: Knex): Promise<void> {
  const entityRoot = path.resolve(__dirname, '..', '..');
  const collect = (base: string): Array<{ file: string; full: string }> => {
    const out: Array<{ file: string; full: string }> = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) {
        out.push(...collect(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        out.push({ file: entry.name, full });
      }
    }
    return out;
  };
  const priorFiles = collect(entityRoot)
    .sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0))
    .filter(f => f.file < 'v3.9.0_1');

  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.9.0_1', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v3901-'));
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
    await buildPreV3901Schema(db);
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
      log_console_level: 'silent',
      log_file_level: 'silent',
      log_file_max_file_size: 50,
      log_file_number_of_files: 5,
      log_database_level: 'silent',
      log_database_max_number_of_logs: 100000,
      log_loki_level: 'silent',
      log_loki_interval: 60,
      log_oia_level: 'silent',
      log_oia_interval: 10,
      proxy_enabled: 0,
      proxy_port: 9000,
      oibus_version: '3.9.0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  describe('up', () => {
    it('adds the auth_token_duration and forward_proxy_enabled columns to engines', async () => {
      await up(db);
      const cols = await columnNames(db, 'engines');
      assert.ok(cols.includes('auth_token_duration'), 'engines.auth_token_duration added');
      assert.ok(cols.includes('forward_proxy_enabled'), 'engines.forward_proxy_enabled added');
    });

    it("defaults auth_token_duration to '7d' (matching the previously hardcoded '7d' JWT expiresIn)", async () => {
      await up(db);
      const row = await db('engines').where('id', 'test-engine-id').first();
      assert.strictEqual(row.auth_token_duration, '7d');
    });

    it('backfills forward_proxy_enabled to false when forward_proxy_url is null', async () => {
      await up(db);
      const row = await db('engines').where('id', 'test-engine-id').first();
      assert.strictEqual(row.forward_proxy_enabled, 0);
    });

    it('backfills forward_proxy_enabled to true when forward_proxy_url was already set', async () => {
      await db('engines').where('id', 'test-engine-id').update({ forward_proxy_url: 'http://forward-proxy:3128' });

      await up(db);

      const row = await db('engines').where('id', 'test-engine-id').first();
      assert.strictEqual(row.forward_proxy_enabled, 1);
    });
  });

  describe('down', () => {
    it('drops the auth_token_duration and forward_proxy_enabled columns', async () => {
      await up(db);
      await down(db);
      const cols = await columnNames(db, 'engines');
      assert.ok(!cols.includes('auth_token_duration'), 'engines.auth_token_duration removed');
      assert.ok(!cols.includes('forward_proxy_enabled'), 'engines.forward_proxy_enabled removed');
    });
  });

  it('is reversible: up → down → up produces the columns with the default values', async () => {
    await up(db);
    await down(db);
    await up(db);

    const row = await db('engines').where('id', 'test-engine-id').first();
    assert.strictEqual(row.auth_token_duration, '7d');
    assert.strictEqual(row.forward_proxy_enabled, 0);
  });

  describe('opcua maxParallelRun', () => {
    async function insertSouthConnector(type: string, settings: object, id = 'south-1') {
      await db('south_connectors').insert({
        id,
        name: `Test ${type}`,
        type,
        description: '',
        enabled: 1,
        settings: JSON.stringify(settings),
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    async function insertHistoryQuery(southType: string, southSettings: object, id = 'history-1') {
      await db('scan_modes').insert({
        id: 'scan-mode-1',
        name: 'Every 10s',
        description: '',
        cron: '*/10 * * * * *',
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('history_queries').insert({
        id,
        status: 'PENDING',
        name: `Test ${id}`,
        description: '',
        start_time: '2026-01-01T00:00:00Z',
        end_time: '2026-01-02T00:00:00Z',
        south_type: southType,
        north_type: 'file-writer',
        south_settings: JSON.stringify(southSettings),
        north_settings: '{}',
        caching_trigger_schedule: 'scan-mode-1',
        caching_trigger_number_of_elements: 1000,
        caching_trigger_number_of_files: 1,
        caching_throttling_cache_max_size: 0,
        caching_throttling_max_number_of_elements: 10000,
        caching_error_retry_interval: 1000,
        caching_error_retry_count: 3,
        caching_archive_enabled: 0,
        caching_archive_retention_duration: 0,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    it('backfills maxParallelRun to 1 on an opcua south connector', async () => {
      await insertSouthConnector('opcua', { url: 'opc.tcp://localhost:4840', keepSessionAlive: false });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.maxParallelRun, 1);
      assert.strictEqual(settings.url, 'opc.tcp://localhost:4840', 'existing settings are preserved');
    });

    it('does not touch south connectors of a different type', async () => {
      await insertSouthConnector('mssql', { host: 'localhost' });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.maxParallelRun, undefined);
      assert.strictEqual(settings.host, 'localhost');
    });

    it('backfills maxParallelRun to 1 on an opcua history query south settings', async () => {
      await insertHistoryQuery('opcua', { url: 'opc.tcp://localhost:4840', keepSessionAlive: false });

      await up(db);

      const row = await db('history_queries').where('id', 'history-1').first();
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.maxParallelRun, 1);
      assert.strictEqual(southSettings.url, 'opc.tcp://localhost:4840', 'existing settings are preserved');
    });

    it('does not touch history queries with a different south type', async () => {
      await insertHistoryQuery('mssql', { host: 'localhost' });

      await up(db);

      const row = await db('history_queries').where('id', 'history-1').first();
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.maxParallelRun, undefined);
      assert.strictEqual(southSettings.host, 'localhost');
    });

    it('is reversible: up then down removes maxParallelRun again', async () => {
      await insertSouthConnector('opcua', { url: 'opc.tcp://localhost:4840' });
      await insertHistoryQuery('opcua', { url: 'opc.tcp://localhost:4840' });

      await up(db);
      await down(db);

      const southRow = await db('south_connectors').where('id', 'south-1').first();
      assert.strictEqual(JSON.parse(southRow.settings).maxParallelRun, undefined);
      const historyRow = await db('history_queries').where('id', 'history-1').first();
      assert.strictEqual(JSON.parse(historyRow.south_settings).maxParallelRun, undefined);
    });
  });
});
