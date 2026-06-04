import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { down, up } from './v3.8.0_1';

/**
 * Build the schema as it exists just before v3.8.0_1 by running every prior entity migration
 * in lexicographic order. This includes v3.8.0, which creates the `group_items` table that
 * v3.8.0_1 adds an index to.
 */
async function buildPreV3801Schema(db: Knex): Promise<void> {
  const entityRoot = path.resolve(__dirname, '..', '..');
  const collect = (base: string): Array<{ file: string; full: string }> => {
    const out: Array<{ file: string; full: string }> = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) {
        out.push(...collect(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        out.push({ file: entry.name, full });
      }
    }
    return out;
  };
  const priorFiles = collect(entityRoot)
    .sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0))
    .filter(f => f.file < 'v3.8.0_1');

  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function indexExists(db: Knex, indexName: string): Promise<boolean> {
  const rows = (await db.raw(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName])) as Array<{
    name: string;
  }>;
  return rows.length > 0;
}

describe('Entity migration v3.8.0_1', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    // File-based SQLite required: the migration chain rebuilds several tables (dropColumns / drop+create).
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v3801-'));
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
    await buildPreV3801Schema(db);
  });

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
