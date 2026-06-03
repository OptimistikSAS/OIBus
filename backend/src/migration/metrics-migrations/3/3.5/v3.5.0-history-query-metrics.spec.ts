import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up } from './v3.5.0-history-query-metrics';

/**
 * Create north_metrics in its v3.0 state (before v3.5.0 migration).
 */
async function createV30NorthMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('north_metrics', table => {
    table.string('north_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values');
    table.integer('nb_files');
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.json('last_value');
    table.string('last_file');
    table.integer('cache_size');
  });
}

/**
 * Create south_metrics in its v3.0 state (before v3.5.0 migration).
 */
async function createV30SouthMetrics(db: Knex): Promise<void> {
  await db.schema.createTable('south_metrics', table => {
    table.string('south_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values');
    table.integer('nb_files');
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.json('last_value');
    table.string('last_file');
  });
}

describe('Metrics migration v3.5.0 history query metrics', () => {
  let db: Knex;

  beforeEach(async () => {
    // ADD COLUMN does not require table recreation — in-memory SQLite is sufficient
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    // up() operates on north_metrics and south_metrics — create them both
    await createV30NorthMetrics(db);
    await createV30SouthMetrics(db);
  });

  afterEach(async () => {
    await db?.destroy();
  });

  describe('history_query_metrics', () => {
    it('creates the table with the expected columns', async () => {
      await up(db);

      const cols = (await db.raw('PRAGMA table_info(history_query_metrics)')) as Array<{ name: string }>;
      const names = cols.map(c => c.name);

      assert.ok(names.includes('history_query_id'), 'history_query_id');
      assert.ok(names.includes('metrics_start'), 'metrics_start');
      assert.ok(names.includes('nb_values_retrieved'), 'nb_values_retrieved');
      assert.ok(names.includes('nb_files_retrieved'), 'nb_files_retrieved');
      assert.ok(names.includes('last_value_retrieved'), 'last_value_retrieved');
      assert.ok(names.includes('last_file_retrieved'), 'last_file_retrieved');
      assert.ok(names.includes('last_south_connection'), 'last_south_connection');
      assert.ok(names.includes('last_south_run_start'), 'last_south_run_start');
      assert.ok(names.includes('last_south_run_duration'), 'last_south_run_duration');
      assert.ok(names.includes('nb_values_sent'), 'nb_values_sent');
      assert.ok(names.includes('nb_files_sent'), 'nb_files_sent');
      assert.ok(names.includes('last_value_sent'), 'last_value_sent');
      assert.ok(names.includes('last_file_sent'), 'last_file_sent');
      assert.ok(names.includes('last_north_connection'), 'last_north_connection');
      assert.ok(names.includes('last_north_run_start'), 'last_north_run_start');
      assert.ok(names.includes('last_north_run_duration'), 'last_north_run_duration');
      assert.ok(names.includes('north_cache_size'), 'north_cache_size');
      assert.ok(names.includes('north_error_size'), 'north_error_size');
      assert.ok(names.includes('north_archive_size'), 'north_archive_size');
      assert.strictEqual(names.length, 19, 'exact column count');
    });

    it('starts empty', async () => {
      await up(db);
      const row = await db('history_query_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0);
    });
  });

  describe('north_metrics', () => {
    it('adds error_size and archive_size columns', async () => {
      await up(db);

      const cols = (await db.raw('PRAGMA table_info(north_metrics)')) as Array<{ name: string }>;
      const names = cols.map(c => c.name);

      assert.ok(names.includes('error_size'), 'error_size should be added');
      assert.ok(names.includes('archive_size'), 'archive_size should be added');
      // v3.0 columns must all be preserved
      assert.ok(names.includes('north_id'));
      assert.ok(names.includes('metrics_start'));
      assert.ok(names.includes('nb_values'));
      assert.ok(names.includes('nb_files'));
      assert.ok(names.includes('last_connection'));
      assert.ok(names.includes('last_run_start'));
      assert.ok(names.includes('last_run_duration'));
      assert.ok(names.includes('last_value'));
      assert.ok(names.includes('last_file'));
      assert.ok(names.includes('cache_size'));
      assert.strictEqual(names.length, 12, 'v3.0 columns (10) + error_size + archive_size');
    });

    it('deletes all existing rows', async () => {
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });
      await db('north_metrics').insert({ north_id: 'n2', metrics_start: '2025-01-02T00:00:00.000Z' });

      await up(db);

      const row = await db('north_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0, 'all north_metrics rows must be cleared');
    });

    it('new error_size and archive_size columns are nullable for remaining rows', async () => {
      // Rows inserted AFTER the migration should accept NULL for the new columns
      await up(db);
      await db('north_metrics').insert({ north_id: 'n1', metrics_start: '2025-01-01T00:00:00.000Z' });

      const r = await db('north_metrics').first();
      assert.strictEqual(r.error_size, null);
      assert.strictEqual(r.archive_size, null);
    });
  });

  describe('south_metrics', () => {
    it('deletes all existing rows', async () => {
      await db('south_metrics').insert({ south_id: 's1', metrics_start: '2025-01-01T00:00:00.000Z' });
      await db('south_metrics').insert({ south_id: 's2', metrics_start: '2025-01-02T00:00:00.000Z' });

      await up(db);

      const row = await db('south_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0, 'all south_metrics rows must be cleared');
    });

    it('schema is unchanged after migration', async () => {
      await up(db);

      const cols = (await db.raw('PRAGMA table_info(south_metrics)')) as Array<{ name: string }>;
      const names = cols.map(c => c.name);
      // south_metrics only loses data, no schema changes
      assert.ok(names.includes('south_id'));
      assert.ok(names.includes('metrics_start'));
      assert.ok(names.includes('nb_values'));
      assert.strictEqual(names.length, 9, 'south_metrics schema must be unchanged');
    });
  });

  it('handles completely empty tables without error', async () => {
    // No rows in either table — must not throw
    await up(db);
  });
});
