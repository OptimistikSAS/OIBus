import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { up } from './v3.8.3_2-drop-current-sizes';

/** north_metrics as it stands after v3.8.3 (still carrying the current_* gauge columns). */
async function createNorthMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('north_metrics', table => {
    table.string('north_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.integer('content_sent_size');
    table.integer('content_cached_size');
    table.integer('content_errored_size');
    table.integer('content_archived_size');
    table.integer('current_cache_size');
    table.integer('current_error_size');
    table.integer('current_archive_size');
    table.string('last_content_sent');
  });
}

/** history_query_metrics as it stands after v3.8.3 (still carrying north_current_* gauge columns). */
async function createHistoryQueryMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('history_query_metrics', table => {
    table.string('history_query_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values_retrieved');
    table.integer('nb_files_retrieved');
    table.datetime('last_south_connection');
    table.datetime('last_south_run_start');
    table.integer('last_south_run_duration');
    table.datetime('last_north_connection');
    table.datetime('last_north_run_start');
    table.integer('last_north_run_duration');
    table.integer('content_sent_size');
    table.integer('content_cached_size');
    table.integer('content_errored_size');
    table.integer('content_archived_size');
    table.integer('north_current_cache_size');
    table.integer('north_current_error_size');
    table.integer('north_current_archive_size');
    table.string('last_content_sent');
  });
}

describe('Metrics migration v3.8.4 drop current sizes', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-metrics-v384-'));
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
    // up() operates on BOTH tables — always create them both so the migration runs end-to-end
    await createNorthMetrics(db);
    await createHistoryQueryMetrics(db);
  });

  describe('north_metrics', () => {
    it('drops the three current size columns and preserves the rest', async () => {
      await db('north_metrics').insert({
        north_id: 'n1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        content_sent_size: 11,
        current_cache_size: 99
      });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(north_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('current_cache_size'), 'current_cache_size should be dropped');
      assert.ok(!names.includes('current_error_size'), 'current_error_size should be dropped');
      assert.ok(!names.includes('current_archive_size'), 'current_archive_size should be dropped');

      // Persisted counters/timing/last* are preserved
      assert.ok(names.includes('content_sent_size'));
      assert.ok(names.includes('content_cached_size'));
      assert.ok(names.includes('content_errored_size'));
      assert.ok(names.includes('content_archived_size'));
      assert.ok(names.includes('last_content_sent'));
      assert.ok(names.includes('last_connection'));

      // Existing row data survives the table rebuild
      const row = await db('north_metrics').where({ north_id: 'n1' }).first();
      assert.strictEqual(row.content_sent_size, 11);
    });
  });

  describe('history_query_metrics', () => {
    it('drops the three north current size columns and preserves the rest', async () => {
      await db('history_query_metrics').insert({
        history_query_id: 'h1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        content_sent_size: 7,
        north_current_cache_size: 42
      });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(history_query_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('north_current_cache_size'), 'north_current_cache_size should be dropped');
      assert.ok(!names.includes('north_current_error_size'), 'north_current_error_size should be dropped');
      assert.ok(!names.includes('north_current_archive_size'), 'north_current_archive_size should be dropped');

      assert.ok(names.includes('content_sent_size'));
      assert.ok(names.includes('nb_values_retrieved'));
      assert.ok(names.includes('last_content_sent'));

      const row = await db('history_query_metrics').where({ history_query_id: 'h1' }).first();
      assert.strictEqual(row.content_sent_size, 7);
    });
  });

  it('is idempotent when the columns are already absent', async () => {
    await up(db); // first run drops them
    await up(db); // second run must not throw

    const northColumns = (await db.raw('PRAGMA table_info(north_metrics)')) as Array<{ name: string }>;
    assert.ok(!northColumns.map(c => c.name).includes('current_cache_size'));
  });
});
