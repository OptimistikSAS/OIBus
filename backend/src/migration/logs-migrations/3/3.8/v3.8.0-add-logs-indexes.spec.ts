import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { config, down, up } from './v3.8.0-add-logs-indexes';

/**
 * Create the logs table as it exists immediately before this migration runs
 * (after v3.0 initial setup + v3.2.0 schema rebuild + v3.7.1 column renames).
 *
 * Columns: timestamp (NOT NULL), level (NOT NULL), scope_type (NOT NULL),
 *          scope_id, scope_name, message (NOT NULL).
 */
async function createLogsTable(db: Knex): Promise<void> {
  await db.schema.createTable('logs', table => {
    table.datetime('timestamp').notNullable();
    table.string('level').notNullable().defaultTo('');
    table.string('scope_type').notNullable().defaultTo('');
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });
}

async function indexExists(db: Knex, indexName: string): Promise<boolean> {
  const rows = (await db.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName])) as Array<{
    name: string;
  }>;
  return rows.length > 0;
}

describe('Logs migration v3.8.0 (add-logs-indexes)', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    // File-based SQLite is required: VACUUM is a no-op on :memory: and
    // auto_vacuum mode only applies to persistent databases.
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-logs-v380-'));
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
    await createLogsTable(db);
  });

  // ─── Contract: config.transaction = false ──────────────────────────────────

  it('exports config.transaction = false so the migration runner does not wrap in a transaction', () => {
    // VACUUM cannot run inside an active transaction; this export tells knex to
    // call up(knex) without BEGIN/COMMIT wrapping.
    assert.deepStrictEqual(config, { transaction: false });
  });

  // ─── up: index creation ────────────────────────────────────────────────────

  it('creates idx_logs_timestamp on the timestamp column', async () => {
    assert.equal(await indexExists(db, 'idx_logs_timestamp'), false, 'index should not exist before migration');

    await up(db);

    assert.equal(await indexExists(db, 'idx_logs_timestamp'), true, 'idx_logs_timestamp should exist after migration');
  });

  it('idx_logs_timestamp covers exactly the timestamp column', async () => {
    await up(db);

    const info = (await db.raw('PRAGMA index_info(idx_logs_timestamp)')) as Array<{ name: string }>;
    assert.deepEqual(
      info.map(r => r.name),
      ['timestamp'],
      'index should cover exactly the timestamp column'
    );
  });

  it('creates idx_logs_scope on (scope_id, scope_type)', async () => {
    assert.equal(await indexExists(db, 'idx_logs_scope'), false, 'index should not exist before migration');

    await up(db);

    assert.equal(await indexExists(db, 'idx_logs_scope'), true, 'idx_logs_scope should exist after migration');
  });

  it('idx_logs_scope covers scope_id as leading column and scope_type as second column', async () => {
    await up(db);

    const info = (await db.raw('PRAGMA index_info(idx_logs_scope)')) as Array<{ seqno: number; name: string }>;
    const columns = info.sort((a, b) => a.seqno - b.seqno).map(r => r.name);
    assert.deepEqual(columns, ['scope_id', 'scope_type'], 'scope_id must be the leading column');
  });

  // ─── up: auto_vacuum + VACUUM ──────────────────────────────────────────────

  it('sets auto_vacuum to FULL (mode 1)', async () => {
    await up(db);

    const [row] = (await db.raw('PRAGMA auto_vacuum;')) as Array<{ auto_vacuum: number }>;
    assert.strictEqual(row.auto_vacuum, 1, 'auto_vacuum should be FULL (1) after migration');
  });

  it('works on an empty logs table', async () => {
    await up(db); // must not throw even with no rows
  });

  it('works on a populated logs table', async () => {
    await db('logs').insert([
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'info',
        scope_type: 'south',
        scope_id: 's1',
        scope_name: 'MQTT',
        message: 'connected'
      },
      { timestamp: '2025-01-01T00:01:00.000Z', level: 'error', scope_type: 'north', scope_id: 'n1', scope_name: 'OIA', message: 'timeout' }
    ]);

    await up(db); // must not throw and must preserve data

    const count = await db('logs').count('* as c').first();
    assert.strictEqual(Number(count!.c), 2, 'existing rows must be preserved after VACUUM + index creation');
  });

  // ─── up: idempotency (IF NOT EXISTS) ──────────────────────────────────────

  it('is idempotent — running up() twice does not throw', async () => {
    await up(db);
    await up(db); // CREATE INDEX IF NOT EXISTS is a no-op the second time
  });

  // ─── down: index removal ───────────────────────────────────────────────────

  it('drops idx_logs_timestamp on rollback', async () => {
    await up(db);
    assert.equal(await indexExists(db, 'idx_logs_timestamp'), true);

    await down(db);

    assert.equal(await indexExists(db, 'idx_logs_timestamp'), false, 'idx_logs_timestamp should be dropped after rollback');
  });

  it('drops idx_logs_scope on rollback', async () => {
    await up(db);
    assert.equal(await indexExists(db, 'idx_logs_scope'), true);

    await down(db);

    assert.equal(await indexExists(db, 'idx_logs_scope'), false, 'idx_logs_scope should be dropped after rollback');
  });

  it('down is safe when indexes are already absent (DROP INDEX IF EXISTS)', async () => {
    await down(db); // must not throw even if indexes were never created
  });

  // ─── Reversibility ─────────────────────────────────────────────────────────

  it('is reversible: up → down → up re-creates both indexes', async () => {
    await up(db);
    await down(db);
    await up(db);

    assert.equal(await indexExists(db, 'idx_logs_timestamp'), true, 'idx_logs_timestamp should exist after up → down → up');
    assert.equal(await indexExists(db, 'idx_logs_scope'), true, 'idx_logs_scope should exist after up → down → up');
  });
});
