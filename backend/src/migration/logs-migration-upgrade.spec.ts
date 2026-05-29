/**
 * Logs migration upgrade scenarios:
 * - v3.6.5: covers the tableExists=true branch (legacy metrics tables present)
 * - v3.8.0-add-logs-indexes: covers the down() function body (index rollback)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import { up as removeMetricsTablesUp } from './logs-migrations/3/3.6/v3.6.5-remove-metrics-table-if-present';
import { up as addIndexesUp, down as addIndexesDown } from './logs-migrations/3/3.8/v3.8.0-add-logs-indexes';
import { migrateLogs } from './migration-service';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('logs-migration v3.6.5 upgrade scenario (tables present)', () => {
  it('drops legacy metrics tables when they exist (tableExists=true branch)', async () => {
    const db = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
      for (const table of ['north_metrics', 'south_metrics', 'engine_metrics', 'history_query_metrics']) {
        await db.schema.createTable(table, t => {
          t.uuid('id').primary();
          t.string('name');
        });
      }
      assert.ok(await db.schema.hasTable('north_metrics'), 'north_metrics should exist before migration');
      await removeMetricsTablesUp(db);
      for (const table of ['north_metrics', 'south_metrics', 'engine_metrics', 'history_query_metrics']) {
        assert.ok(!(await db.schema.hasTable(table)), `${table} should have been dropped by v3.6.5`);
      }
    } finally {
      await db.destroy();
    }
  });
});

describe('logs-migration v3.8.0-add-logs-indexes', () => {
  it('covers down() by running up() then rolling back with down()', async () => {
    const tmpDb = path.join(os.tmpdir(), `logs-indexes-test-${process.pid}.db`);
    try {
      // Build the logs schema so the migration has the table it needs
      await migrateLogs(tmpDb);

      const db = knex({ client: 'better-sqlite3', connection: { filename: tmpDb }, useNullAsDefault: true });
      try {
        // Run up() again (idempotent — IF NOT EXISTS)
        await addIndexesUp(db);

        // Run down() to cover that function body
        await addIndexesDown(db);

        // Indexes should be gone after down()
        const indexes = await db.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_logs_%'`);
        assert.strictEqual(indexes.length, 0, 'idx_logs_* indexes should be removed by down()');
      } finally {
        await db.destroy();
      }
    } finally {
      await fs.rm(tmpDb, { force: true });
    }
  });
});
