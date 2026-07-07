import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.1.0-initial-setup-fix';

const THIS_FILE = 'v3.1.0-initial-setup-fix.ts';

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

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertHistoryQuery(db: Knex, id: string, name: string, enabled: boolean) {
  await db('history_queries').insert({
    id,
    name,
    enabled,
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
}

describe('Entity migration v3.1.0-initial-setup-fix', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v310-'));
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

  it('runs end-to-end on a realistic pre-3.1.0 schema', async () => {
    await up(db); // must not throw
  });

  it('adds a status column defaulting to PENDING', async () => {
    await up(db);
    const cols = await columnNames(db, 'history_queries');
    assert.ok(cols.includes('status'));
  });

  it('sets status to RUNNING for enabled history queries', async () => {
    await insertHistoryQuery(db, 'history-1', 'History A', true);

    await up(db);

    const row = await db('history_queries').where('id', 'history-1').first();
    assert.strictEqual(row.status, 'RUNNING');
  });

  it('leaves status as PENDING for disabled history queries', async () => {
    await insertHistoryQuery(db, 'history-2', 'History B', false);

    await up(db);

    const row = await db('history_queries').where('id', 'history-2').first();
    assert.strictEqual(row.status, 'PENDING');
  });

  it('preserves history_queries data across the table rebuild', async () => {
    await insertHistoryQuery(db, 'history-3', 'History C', true);

    await up(db);

    const row = await db('history_queries').where('id', 'history-3').first();
    assert.strictEqual(row.name, 'History C');
    assert.strictEqual(row.south_type, 'mssql');
    assert.strictEqual(row.north_type, 'oianalytics');
    assert.strictEqual(row.caching_scan_mode_id, 'scan-mode-1');
  });

  it('enforces a unique constraint on history_queries.name after rebuild', async () => {
    await up(db);
    // After the rebuild the `enabled` column is gone (replaced by `status`), so insert directly.
    const postRebuildRow = (id: string, name: string) => ({
      id,
      name,
      status: 'PENDING',
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
    await db('history_queries').insert(postRebuildRow('history-4', 'Duplicate Name'));
    await assert.rejects(db('history_queries').insert(postRebuildRow('history-5', 'Duplicate Name')));
  });

  it('preserves history_items data and adds a foreign key + unique constraint on (history_id, name)', async () => {
    await insertHistoryQuery(db, 'history-6', 'History F', true);
    await db('history_items').insert({
      id: 'history-item-1',
      history_id: 'history-6',
      name: 'Item A',
      enabled: true,
      description: 'desc',
      settings: '{"key":"value"}'
    });

    await up(db);

    const item = await db('history_items').where('id', 'history-item-1').first();
    assert.strictEqual(item.history_id, 'history-6');
    assert.strictEqual(item.name, 'Item A');
    assert.strictEqual(item.settings, '{"key":"value"}');

    // unique constraint on (history_id, name) — inserting a duplicate pair must fail
    await assert.rejects(
      db('history_items').insert({
        id: 'history-item-2',
        history_id: 'history-6',
        name: 'Item A',
        enabled: true,
        settings: '{}'
      })
    );
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    const cols = await columnNames(db, 'history_queries');
    assert.ok(cols.includes('status'), 'down does not revert the migration');
  });
});
