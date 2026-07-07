import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { up, down } from './v3.8.3_1-fix-north-metrics';

/**
 * Build the broken north_metrics schema that results from the v3.6.0 migration running
 * with wrong dropColumns names: nb_values/nb_files/last_value/last_file were never dropped.
 */
async function createBrokenNorthMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('north_metrics', table => {
    table.string('north_id').notNullable();
    table.datetime('metrics_start').notNullable();
    // OLD columns that should have been dropped by v3.6.0 but weren't
    table.integer('nb_values');
    table.integer('nb_files');
    table.json('last_value');
    table.string('last_file');
    // Timing columns (always kept)
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    // New columns added by v3.6.0
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

/**
 * Build the broken history_query_metrics schema: v3.6.0 correctly dropped the _sent columns
 * but left north_cache_size/north_error_size/north_archive_size behind.
 */
async function createBrokenHistoryQueryMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('history_query_metrics', table => {
    table.string('history_query_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values_retrieved');
    table.integer('nb_files_retrieved');
    table.datetime('last_south_connection');
    table.datetime('last_south_run_start');
    table.integer('last_south_run_duration');
    // OLD north size columns that v3.6.0 missed
    table.integer('north_cache_size');
    table.integer('north_error_size');
    table.integer('north_archive_size');
    table.datetime('last_north_connection');
    table.datetime('last_north_run_start');
    table.integer('last_north_run_duration');
    // New columns added by v3.6.0
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

describe('Metrics repair migration v3.8.3', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-metrics-v380-'));
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
    await createBrokenNorthMetrics(db);
    await createBrokenHistoryQueryMetrics(db);
  });

  describe('north_metrics', () => {
    it('drops the four lingering old columns', async () => {
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(north_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('nb_values'), 'nb_values should be dropped');
      assert.ok(!names.includes('nb_files'), 'nb_files should be dropped');
      assert.ok(!names.includes('last_value'), 'last_value should be dropped');
      assert.ok(!names.includes('last_file'), 'last_file should be dropped');

      // New and timing columns preserved
      assert.ok(names.includes('content_sent_size'));
      assert.ok(names.includes('content_cached_size'));
      assert.ok(names.includes('content_errored_size'));
      assert.ok(names.includes('content_archived_size'));
      assert.ok(names.includes('current_cache_size'));
      assert.ok(names.includes('current_error_size'));
      assert.ok(names.includes('current_archive_size'));
      assert.ok(names.includes('last_connection'));
      assert.ok(names.includes('last_content_sent'));
    });

    it('sets all seven NULL integer columns to 0', async () => {
      // All new columns are NULL — simulates an old 3.7.x initMetrics INSERT
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const row = await db('north_metrics').where({ north_id: 'n1' }).first();
      assert.strictEqual(row.content_sent_size, 0);
      assert.strictEqual(row.content_cached_size, 0);
      assert.strictEqual(row.content_errored_size, 0);
      assert.strictEqual(row.content_archived_size, 0);
      assert.strictEqual(row.current_cache_size, 0);
      assert.strictEqual(row.current_error_size, 0);
      assert.strictEqual(row.current_archive_size, 0);
    });

    it('does not overwrite existing non-null values', async () => {
      await db('north_metrics').insert({
        north_id: 'n1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        content_sent_size: 42,
        content_cached_size: 10,
        content_errored_size: 5,
        content_archived_size: 3,
        current_cache_size: 100,
        current_error_size: 0,
        current_archive_size: 0
      });

      await up(db);

      const row = await db('north_metrics').where({ north_id: 'n1' }).first();
      assert.strictEqual(row.content_sent_size, 42);
      assert.strictEqual(row.content_cached_size, 10);
      assert.strictEqual(row.content_errored_size, 5);
      assert.strictEqual(row.content_archived_size, 3);
      assert.strictEqual(row.current_cache_size, 100);
      assert.strictEqual(row.current_error_size, 0);
      assert.strictEqual(row.current_archive_size, 0);
    });

    it('handles a mix of NULL and non-NULL rows', async () => {
      // Old row — all new columns NULL
      await db('north_metrics').insert({ north_id: 'old', metrics_start: '2025-01-01T00:00:00.000Z' });
      // New row — already properly initialized
      await db('north_metrics').insert({
        north_id: 'new',
        metrics_start: '2025-06-01T00:00:00.000Z',
        content_sent_size: 999,
        content_cached_size: 0,
        content_errored_size: 1,
        content_archived_size: 0,
        current_cache_size: 50,
        current_error_size: 0,
        current_archive_size: 0
      });

      await up(db);

      const old = await db('north_metrics').where({ north_id: 'old' }).first();
      assert.strictEqual(old.content_sent_size, 0);
      assert.strictEqual(old.current_cache_size, 0);

      const newRow = await db('north_metrics').where({ north_id: 'new' }).first();
      assert.strictEqual(newRow.content_sent_size, 999);
      assert.strictEqual(newRow.content_errored_size, 1);
      assert.strictEqual(newRow.current_cache_size, 50);
    });

    it('is idempotent when old columns are already absent', async () => {
      // Simulate a fresh install where v3.6.0 already ran with corrected column names.
      // The table must have ALL columns the migration's COALESCE update references.
      await db.schema.dropTable('north_metrics');
      await db.schema.createTable('north_metrics', table => {
        table.string('north_id').notNullable();
        table.datetime('metrics_start').notNullable();
        table.datetime('last_connection');
        table.datetime('last_run_start');
        table.integer('last_run_duration');
        table.integer('content_sent_size').defaultTo(0);
        table.integer('content_cached_size').defaultTo(0);
        table.integer('content_errored_size').defaultTo(0);
        table.integer('content_archived_size').defaultTo(0);
        table.integer('current_cache_size').defaultTo(0);
        table.integer('current_error_size').defaultTo(0);
        table.integer('current_archive_size').defaultTo(0);
        table.string('last_content_sent');
      });
      await db('north_metrics').insert({
        north_id: 'n1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        content_sent_size: 5,
        current_cache_size: 10
      });

      await up(db); // must not throw

      const row = await db('north_metrics').first();
      assert.strictEqual(row.content_sent_size, 5);
      assert.strictEqual(row.current_cache_size, 10);
    });
  });

  describe('history_query_metrics', () => {
    it('drops the three superseded north size columns', async () => {
      await db('history_query_metrics').insert({ history_query_id: 'h1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const columns = (await db.raw('PRAGMA table_info(history_query_metrics)')) as Array<{ name: string }>;
      const names = columns.map(c => c.name);

      assert.ok(!names.includes('north_cache_size'), 'north_cache_size should be dropped');
      assert.ok(!names.includes('north_error_size'), 'north_error_size should be dropped');
      assert.ok(!names.includes('north_archive_size'), 'north_archive_size should be dropped');

      assert.ok(names.includes('north_current_cache_size'));
      assert.ok(names.includes('north_current_error_size'));
      assert.ok(names.includes('north_current_archive_size'));
      assert.ok(names.includes('content_sent_size'));
      assert.ok(names.includes('nb_values_retrieved'));
    });

    it('sets all seven NULL integer columns to 0', async () => {
      await db('history_query_metrics').insert({ history_query_id: 'h1', metrics_start: '2025-01-01T00:00:00.000Z' });

      await up(db);

      const row = await db('history_query_metrics').where({ history_query_id: 'h1' }).first();
      assert.strictEqual(row.content_sent_size, 0);
      assert.strictEqual(row.content_cached_size, 0);
      assert.strictEqual(row.content_errored_size, 0);
      assert.strictEqual(row.content_archived_size, 0);
      assert.strictEqual(row.north_current_cache_size, 0);
      assert.strictEqual(row.north_current_error_size, 0);
      assert.strictEqual(row.north_current_archive_size, 0);
    });

    it('does not overwrite existing non-null values', async () => {
      await db('history_query_metrics').insert({
        history_query_id: 'h1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        content_sent_size: 77,
        content_cached_size: 5,
        content_errored_size: 2,
        content_archived_size: 1,
        north_current_cache_size: 20,
        north_current_error_size: 0,
        north_current_archive_size: 0
      });

      await up(db);

      const row = await db('history_query_metrics').where({ history_query_id: 'h1' }).first();
      assert.strictEqual(row.content_sent_size, 77);
      assert.strictEqual(row.content_cached_size, 5);
      assert.strictEqual(row.content_errored_size, 2);
      assert.strictEqual(row.content_archived_size, 1);
      assert.strictEqual(row.north_current_cache_size, 20);
    });

    it('is idempotent when old size columns are already absent', async () => {
      // Simulate an install where v3.6.0 already cleaned up these columns.
      // The table must have ALL columns the migration's COALESCE update references.
      await db.schema.dropTable('history_query_metrics');
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
        table.integer('content_sent_size').defaultTo(0);
        table.integer('content_cached_size').defaultTo(0);
        table.integer('content_errored_size').defaultTo(0);
        table.integer('content_archived_size').defaultTo(0);
        table.integer('north_current_cache_size').defaultTo(0);
        table.integer('north_current_error_size').defaultTo(0);
        table.integer('north_current_archive_size').defaultTo(0);
        table.string('last_content_sent');
      });
      await db('history_query_metrics').insert({
        history_query_id: 'h1',
        metrics_start: '2025-01-01T00:00:00.000Z',
        north_current_cache_size: 8,
        content_sent_size: 3
      });

      await up(db); // must not throw

      const row = await db('history_query_metrics').first();
      assert.strictEqual(row.north_current_cache_size, 8);
      assert.strictEqual(row.content_sent_size, 3);
    });
  });

  it('handles completely empty tables without error', async () => {
    // No rows inserted — migration must not throw on empty tables
    await up(db);
  });

  it('down is a no-op', async () => {
    await assert.doesNotReject(() => down());
  });
});
