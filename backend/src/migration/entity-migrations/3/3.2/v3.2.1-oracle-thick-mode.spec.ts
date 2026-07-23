import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.2.1-oracle-thick-mode';

const THIS_FILE = 'v3.2.1-oracle-thick-mode.ts';

/**
 * Collect every entity migration file (excluding specs) under the entity-migrations root,
 * sorted lexicographically by filename — the same order OIBus's migration runner uses.
 */
function entityMigrationFiles(): Array<{ file: string; full: string }> {
  const root = path.resolve(__dirname, '..', '..'); // .../entity-migrations
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
  return collect(root).sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0));
}

/** Build the real schema as it exists just before this migration by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < THIS_FILE);
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function insertSouthConnector(db: Knex, id: string, type: string, settings: unknown) {
  await db('south_connectors').insert({
    id,
    name: `South ${id}`,
    type,
    enabled: true,
    settings: JSON.stringify(settings),
    history_max_instant_per_item: 1,
    history_max_read_interval: 3600,
    history_read_delay: 200
  });
}

async function insertHistoryQuery(db: Knex, id: string, southType: string, southSettings: unknown) {
  await db('history_queries').insert({
    id,
    name: `History ${id}`,
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: southType,
    north_type: 'file-writer',
    south_settings: JSON.stringify(southSettings),
    north_settings: JSON.stringify({ outputFolder: 'output' }),
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
}

describe('Entity migration v3.2.1-oracle-thick-mode', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v321-'));
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
    await buildPriorSchema(db);
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', cron: '*/10 * * * * *' });
  });

  it('runs end-to-end on a realistic pre-3.2.1 schema', async () => {
    await up(db); // must not throw
  });

  describe('south oracle connector settings', () => {
    it('adds thickMode: false and an empty oracleClient to an oracle south connector', async () => {
      await insertSouthConnector(db, 'south-1', 'oracle', {
        host: 'oracle-host',
        port: 1521,
        connectionTimeout: 1000,
        database: 'orcl',
        username: 'user',
        password: 'pass'
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.thickMode, false);
      assert.strictEqual(settings.oracleClient, '');
      assert.strictEqual(settings.host, 'oracle-host');
      assert.strictEqual(settings.port, 1521);
      assert.strictEqual(settings.username, 'user');
    });

    it('does not touch settings of south connectors of other types', async () => {
      await insertSouthConnector(db, 'south-2', 'mssql', { host: 'mssql-host', port: 1433 });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-2').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.thickMode, undefined);
      assert.strictEqual(settings.host, 'mssql-host');
    });
  });

  describe('history query oracle south settings', () => {
    it('adds thickMode: false and an empty oracleClient for a history query with an oracle south', async () => {
      await insertHistoryQuery(db, 'history-1', 'oracle', {
        host: 'oracle-host',
        port: 1521,
        connectionTimeout: 1000,
        database: 'orcl',
        username: 'user',
        password: 'pass'
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-1').first();
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.thickMode, false);
      assert.strictEqual(southSettings.oracleClient, '');
      assert.strictEqual(southSettings.database, 'orcl');
    });

    it('does not touch south_settings for a history query with a non-oracle south', async () => {
      await insertHistoryQuery(db, 'history-2', 'mssql', { host: 'mssql-host', port: 1433 });

      await up(db);

      const row = await db('history_queries').where('id', 'history-2').first();
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.thickMode, undefined);
      assert.strictEqual(southSettings.host, 'mssql-host');
    });
  });

  it('down is a no-op', async () => {
    await insertSouthConnector(db, 'south-3', 'oracle', {
      host: 'oracle-host',
      port: 1521,
      connectionTimeout: 1000,
      database: 'orcl',
      username: 'user',
      password: 'pass'
    });
    await up(db);
    await down(db);

    const row = await db('south_connectors').where('id', 'south-3').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.thickMode, false, 'down does not revert the migration');
  });
});
