import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { up } from './v3.6.0-update-cache-metrics';

/**
 * Build the pre-v3.6.0 north_metrics schema (v3.0 + v3.5.0 additions).
 * The migration must drop 7 columns and add 8 new ones.
 */
async function createOldNorthMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('north_metrics', table => {
    table.string('north_id').notNullable();
    table.datetime('metrics_start').notNullable();
    // v3.0 columns — nb_values/nb_files have no '_sent' suffix (unlike history_query_metrics)
    table.integer('nb_values');
    table.integer('nb_files');
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.json('last_value');
    table.string('last_file');
    table.integer('cache_size');
    // v3.5.0 additions
    table.integer('error_size');
    table.integer('archive_size');
  });
}

/**
 * Build the pre-v3.6.0 history_query_metrics schema (v3.5.0).
 * The migration must drop 4 '_sent' columns and add 8 new ones.
 */
async function createOldHistoryQueryMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('history_query_metrics', table => {
    table.string('history_query_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values_retrieved');
    table.integer('nb_files_retrieved');
    table.json('last_value_retrieved');
    table.string('last_file_retrieved');
    table.datetime('last_south_connection');
    table.datetime('last_south_run_start');
    table.integer('last_south_run_duration');
    // v3.5.0 north columns — v3.6.0 drops only the four '_sent' ones
    table.integer('nb_values_sent');
    table.integer('nb_files_sent');
    table.json('last_value_sent');
    table.string('last_file_sent');
    table.datetime('last_north_connection');
    table.datetime('last_north_run_start');
    table.integer('last_north_run_duration');
    table.integer('north_cache_size');
    table.integer('north_error_size');
    table.integer('north_archive_size');
  });
}

describe('Metrics migration v3.6.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-metrics-v360-'));
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
    await createOldNorthMetrics(db);
    await createOldHistoryQueryMetrics(db);
  });

  describe('north_metrics', () => {
    it('drops old columns and adds new content/cache columns', async () => {
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(north_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('nb_values'), 'nb_values should be dropped');
      assert.ok(!names.includes('nb_files'), 'nb_files should be dropped');
      assert.ok(!names.includes('last_value'), 'last_value should be dropped');
      assert.ok(!names.includes('last_file'), 'last_file should be dropped');
      assert.ok(!names.includes('cache_size'), 'cache_size should be dropped');
      assert.ok(!names.includes('error_size'), 'error_size should be dropped');
      assert.ok(!names.includes('archive_size'), 'archive_size should be dropped');

      assert.ok(names.includes('content_sent_size'), 'content_sent_size should be added');
      assert.ok(names.includes('content_cached_size'), 'content_cached_size should be added');
      assert.ok(names.includes('content_errored_size'), 'content_errored_size should be added');
      assert.ok(names.includes('content_archived_size'), 'content_archived_size should be added');
      assert.ok(names.includes('current_cache_size'), 'current_cache_size should be added');
      assert.ok(names.includes('current_error_size'), 'current_error_size should be added');
      assert.ok(names.includes('current_archive_size'), 'current_archive_size should be added');
      assert.ok(names.includes('last_content_sent'), 'last_content_sent should be added');
      // Preserved columns
      assert.ok(names.includes('north_id'));
      assert.ok(names.includes('metrics_start'));
      assert.ok(names.includes('last_connection'));
      assert.ok(names.includes('last_run_start'));
      assert.ok(names.includes('last_run_duration'));
    });

    it('backfills existing rows with 0 for all new integer columns', async () => {
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });
      await db('north_metrics').insert({ north_id: 'n2', metrics_start: '2025-01-02T00:00:00.000Z' });

      await up(db);

      const rows = await db('north_metrics').select('*');
      assert.strictEqual(rows.length, 2);
      for (const row of rows) {
        assert.strictEqual(row.content_sent_size, 0);
        assert.strictEqual(row.content_cached_size, 0);
        assert.strictEqual(row.content_errored_size, 0);
        assert.strictEqual(row.content_archived_size, 0);
        assert.strictEqual(row.current_cache_size, 0);
        assert.strictEqual(row.current_error_size, 0);
        assert.strictEqual(row.current_archive_size, 0);
        assert.strictEqual(row.last_content_sent, null);
      }
    });
  });

  describe('history_query_metrics', () => {
    it('drops the four _sent columns and adds new content columns', async () => {
      await db('history_query_metrics').insert({ history_query_id: 'h1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(history_query_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('nb_values_sent'), 'nb_values_sent should be dropped');
      assert.ok(!names.includes('nb_files_sent'), 'nb_files_sent should be dropped');
      assert.ok(!names.includes('last_value_sent'), 'last_value_sent should be dropped');
      assert.ok(!names.includes('last_file_sent'), 'last_file_sent should be dropped');

      assert.ok(names.includes('content_sent_size'), 'content_sent_size should be added');
      assert.ok(names.includes('content_cached_size'), 'content_cached_size should be added');
      assert.ok(names.includes('content_errored_size'), 'content_errored_size should be added');
      assert.ok(names.includes('content_archived_size'), 'content_archived_size should be added');
      assert.ok(names.includes('north_current_cache_size'), 'north_current_cache_size should be added');
      assert.ok(names.includes('north_current_error_size'), 'north_current_error_size should be added');
      assert.ok(names.includes('north_current_archive_size'), 'north_current_archive_size should be added');
      assert.ok(names.includes('last_content_sent'), 'last_content_sent should be added');
      // Preserved columns
      assert.ok(names.includes('history_query_id'));
      assert.ok(names.includes('nb_values_retrieved'));
      // v3.6.0 intentionally left these — they are cleaned up by v3.8.0
      assert.ok(names.includes('north_cache_size'), 'north_cache_size should NOT be dropped by v3.6.0');
      assert.ok(names.includes('north_error_size'), 'north_error_size should NOT be dropped by v3.6.0');
      assert.ok(names.includes('north_archive_size'), 'north_archive_size should NOT be dropped by v3.6.0');
    });

    it('backfills existing rows with 0 for new integer columns', async () => {
      await db('history_query_metrics').insert({ history_query_id: 'h1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const rows = await db('history_query_metrics').select('*');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].content_sent_size, 0);
      assert.strictEqual(rows[0].content_cached_size, 0);
      assert.strictEqual(rows[0].content_errored_size, 0);
      assert.strictEqual(rows[0].content_archived_size, 0);
      assert.strictEqual(rows[0].north_current_cache_size, 0);
      assert.strictEqual(rows[0].north_current_error_size, 0);
      assert.strictEqual(rows[0].north_current_archive_size, 0);
      assert.strictEqual(rows[0].last_content_sent, null);
    });
  });

  it('handles completely empty tables without error', async () => {
    // No rows inserted — migration must not throw on empty tables
    await up(db);
  });
});
