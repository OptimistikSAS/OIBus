import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { buildSchemaBefore, createMigrationFileCloneHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.8.0_1';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Build the schema as it exists just before v3.8.0_1 by running every prior entity migration
 * in order. This includes v3.8.0, which creates the `group_items` table that v3.8.0_1 adds an
 * index to.
 */
async function buildPreV3801Schema(db: Knex): Promise<void> {
  await buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.8.0_1.ts', db);
}

async function indexExists(db: Knex, indexName: string): Promise<boolean> {
  const rows = (await db.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName])) as Array<{
    name: string;
  }>;
  return rows.length > 0;
}

describe('Entity migration v3.8.0_1', () => {
  // File-based SQLite required: the migration chain rebuilds several tables (dropColumns /
  // drop+create). Builds the pre-3.8.0_1 schema ONCE into a template file, then hands each test a
  // fresh connection to a copy of it, instead of replaying the whole migration history per test —
  // a real-file rebuild is expensive everywhere, and dramatically so on Windows. A genuinely fresh
  // per-test connection (not a shared transaction/savepoint) is required here: the 'preserves all
  // existing group_items rows' test below toggles `PRAGMA foreign_keys` OFF then back ON mid-test
  // and relies on both taking effect, which SQLite turns into a no-op once any transaction
  // (including a savepoint) is active.
  const harness = createMigrationFileCloneHarness({ buildSchema: buildPreV3801Schema });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  describe('up', () => {
    it('creates the group_items_item_id_idx index on group_items.item_id', async () => {
      assert.equal(await indexExists(db, 'group_items_item_id_idx'), false, 'index should not exist before migration');

      await up(db);

      assert.equal(await indexExists(db, 'group_items_item_id_idx'), true, 'index should exist after migration');
    });

    it('covers the item_id column (verified via index_info)', async () => {
      await up(db);

      const info = (await db.raw(`PRAGMA index_info(group_items_item_id_idx)`)) as Array<{ name: string }>;
      const columns = info.map(r => r.name);
      assert.deepEqual(columns, ['item_id'], 'index should cover exactly the item_id column');
    });

    it('preserves all existing group_items rows', async () => {
      // CREATE INDEX is non-destructive: it never drops or rebuilds the table.
      // Seed a row via raw SQL with FK enforcement off so we don't have to satisfy
      // the full south_item_groups → south_connectors → south_items FK chain.
      await db.raw('PRAGMA foreign_keys = OFF');
      await db.raw(`INSERT INTO group_items (group_id, item_id) VALUES ('grp1', 'item1')`);
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const count = await db('group_items').count('* as c').first();
      assert.equal(Number(count!.c), 1, 'existing rows must survive adding the index');
    });
  });

  describe('down', () => {
    it('drops the group_items_item_id_idx index', async () => {
      await up(db);
      assert.equal(await indexExists(db, 'group_items_item_id_idx'), true, 'index should exist before rollback');

      await down(db);

      assert.equal(await indexExists(db, 'group_items_item_id_idx'), false, 'index should be gone after rollback');
    });
  });

  it('is reversible: up → down → up produces the index', async () => {
    await up(db);
    await down(db);
    await up(db);

    assert.equal(await indexExists(db, 'group_items_item_id_idx'), true, 'index should exist after up → down → up');
  });
});
