import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up } from './v3.0-initial-setup';

/** Return the column names for a table via PRAGMA. */
async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Metrics migration v3.0 initial setup', () => {
  let db: Knex;

  beforeEach(async () => {
    // Pure CREATE TABLE migration — in-memory SQLite is sufficient
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  afterEach(async () => {
    await db?.destroy();
  });

  describe('south_metrics', () => {
    it('creates the table with the expected columns', async () => {
      await up(db);

      const names = await columnNames(db, 'south_metrics');
      assert.ok(names.includes('south_id'), 'south_id');
      assert.ok(names.includes('metrics_start'), 'metrics_start');
      assert.ok(names.includes('nb_values'), 'nb_values');
      assert.ok(names.includes('nb_files'), 'nb_files');
      assert.ok(names.includes('last_connection'), 'last_connection');
      assert.ok(names.includes('last_run_start'), 'last_run_start');
      assert.ok(names.includes('last_run_duration'), 'last_run_duration');
      assert.ok(names.includes('last_value'), 'last_value');
      assert.ok(names.includes('last_file'), 'last_file');
      assert.strictEqual(names.length, 9, 'exact column count');
    });

    it('starts empty', async () => {
      await up(db);
      const row = await db('south_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0);
    });
  });

  describe('north_metrics', () => {
    it('creates the table with the expected columns', async () => {
      await up(db);

      const names = await columnNames(db, 'north_metrics');
      assert.ok(names.includes('north_id'), 'north_id');
      assert.ok(names.includes('metrics_start'), 'metrics_start');
      assert.ok(names.includes('nb_values'), 'nb_values');
      assert.ok(names.includes('nb_files'), 'nb_files');
      assert.ok(names.includes('last_connection'), 'last_connection');
      assert.ok(names.includes('last_run_start'), 'last_run_start');
      assert.ok(names.includes('last_run_duration'), 'last_run_duration');
      assert.ok(names.includes('last_value'), 'last_value');
      assert.ok(names.includes('last_file'), 'last_file');
      assert.ok(names.includes('cache_size'), 'cache_size');
      assert.strictEqual(names.length, 10, 'exact column count');
    });

    it('starts empty', async () => {
      await up(db);
      const row = await db('north_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0);
    });
  });

  describe('engine_metrics', () => {
    it('creates the table with the expected columns', async () => {
      await up(db);

      const names = await columnNames(db, 'engine_metrics');
      assert.ok(names.includes('engine_id'), 'engine_id');
      assert.ok(names.includes('metrics_start'), 'metrics_start');
      assert.ok(names.includes('process_cpu_usage_instant'), 'process_cpu_usage_instant');
      assert.ok(names.includes('process_cpu_usage_average'), 'process_cpu_usage_average');
      assert.ok(names.includes('process_uptime'), 'process_uptime');
      assert.ok(names.includes('free_memory'), 'free_memory');
      assert.ok(names.includes('total_memory'), 'total_memory');
      assert.ok(names.includes('min_rss'), 'min_rss');
      assert.ok(names.includes('current_rss'), 'current_rss');
      assert.ok(names.includes('max_rss'), 'max_rss');
      assert.ok(names.includes('min_heap_total'), 'min_heap_total');
      assert.ok(names.includes('current_heap_total'), 'current_heap_total');
      assert.ok(names.includes('max_heap_total'), 'max_heap_total');
      assert.ok(names.includes('min_heap_used'), 'min_heap_used');
      assert.ok(names.includes('current_heap_used'), 'current_heap_used');
      assert.ok(names.includes('max_heap_used'), 'max_heap_used');
      assert.ok(names.includes('min_external'), 'min_external');
      assert.ok(names.includes('current_external'), 'current_external');
      assert.ok(names.includes('max_external'), 'max_external');
      assert.ok(names.includes('min_array_buffers'), 'min_array_buffers');
      assert.ok(names.includes('current_array_buffers'), 'current_array_buffers');
      assert.ok(names.includes('max_array_buffers'), 'max_array_buffers');
      assert.strictEqual(names.length, 22, 'exact column count');
    });

    it('starts empty', async () => {
      await up(db);
      const row = await db('engine_metrics').count('* as c').first();
      assert.strictEqual(Number(row!.c), 0);
    });
  });
});
