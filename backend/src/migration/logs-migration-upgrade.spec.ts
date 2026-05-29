/**
 * Logs migration upgrade scenario: covers the v3.6.5 branch where legacy metrics tables
 * exist in the logs DB and must be dropped. On a fresh DB those tables are never created,
 * so the `if (tableExists) { drop }` true-branch is never executed by the normal test setup.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import { up as removeMetricsTablesUp } from './logs-migrations/3/3.6/v3.6.5-remove-metrics-table-if-present';

describe('logs-migration v3.6.5 upgrade scenario (tables present)', () => {
  it('drops legacy metrics tables when they exist (tableExists=true branch)', async () => {
    const db = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
      // Pre-create the four metrics tables that v3.6.5 should remove
      for (const table of ['north_metrics', 'south_metrics', 'engine_metrics', 'history_query_metrics']) {
        await db.schema.createTable(table, t => {
          t.uuid('id').primary();
          t.string('name');
        });
      }

      // Confirm they exist before the migration
      assert.ok(await db.schema.hasTable('north_metrics'), 'north_metrics should exist before migration');

      // Run the migration — it should find and drop all four tables
      await removeMetricsTablesUp(db);

      // Confirm they are gone after migration
      for (const table of ['north_metrics', 'south_metrics', 'engine_metrics', 'history_query_metrics']) {
        assert.ok(!(await db.schema.hasTable(table)), `${table} should have been dropped by v3.6.5`);
      }
    } finally {
      await db.destroy();
    }
  });
});
