import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.6.5-remove-metrics-table-if-present';

const METRICS_TABLES = ['north_metrics', 'south_metrics', 'engine_metrics', 'history_query_metrics'];

describe('Logs migration v3.6.5 (remove-metrics-table-if-present)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    for (const table of METRICS_TABLES) {
      await db.schema.dropTableIfExists(table);
    }
  });

  it('does nothing and does not throw when none of the metrics tables exist', async () => {
    for (const table of METRICS_TABLES) {
      assert.strictEqual(await db.schema.hasTable(table), false);
    }

    await up(db);

    for (const table of METRICS_TABLES) {
      assert.strictEqual(await db.schema.hasTable(table), false);
    }
  });

  it('drops each metrics table when it exists', async () => {
    for (const table of METRICS_TABLES) {
      await db.schema.createTable(table, t => {
        t.increments('id');
      });
      assert.ok(await db.schema.hasTable(table));
    }

    await up(db);

    for (const table of METRICS_TABLES) {
      assert.strictEqual(await db.schema.hasTable(table), false, `${table} should be dropped`);
    }
  });

  it('drops only the tables that exist, leaving absent ones untouched (mixed presence)', async () => {
    await db.schema.createTable('north_metrics', t => {
      t.increments('id');
    });
    await db.schema.createTable('history_query_metrics', t => {
      t.increments('id');
    });
    // south_metrics and engine_metrics are intentionally absent.

    await up(db);

    for (const table of METRICS_TABLES) {
      assert.strictEqual(await db.schema.hasTable(table), false);
    }
  });

  it('down is a no-op', async () => {
    await down();
  });
});
