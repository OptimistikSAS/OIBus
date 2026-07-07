import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.8.4';

const PREFIX = 'south_item_cache_';

describe('South cache migration v3.8.4 (consolidate per-connector tables)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw('DROP TABLE IF EXISTS south_item_cache');
    for (const { name } of (await db.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${PREFIX}%'`)) as Array<{
      name: string;
    }>) {
      await db.raw(`DROP TABLE IF EXISTS "${name}"`);
    }
  });

  async function createOldTable(connectorId: string): Promise<void> {
    await db.raw(
      `CREATE TABLE "${PREFIX}${connectorId}" (` +
        'item_id TEXT PRIMARY KEY, ' +
        'group_id TEXT, ' +
        'query_time TEXT, ' +
        'value TEXT, ' +
        'tracked_instant TEXT' +
        ')'
    );
  }

  it('creates south_item_cache with composite primary key', async () => {
    await up(db);
    assert.ok(await db.schema.hasTable('south_item_cache'));
    const info = (await db.raw('PRAGMA table_info(south_item_cache)')) as Array<{ name: string; pk: number }>;
    const pkCols = info.filter(c => c.pk > 0).map(c => c.name);
    assert.deepStrictEqual(pkCols.sort(), ['item_id', 'south_id']);
  });

  it('copies rows from a single connector table with south_id set correctly', async () => {
    await createOldTable('conn-AAA');
    await db.raw(`INSERT INTO "${PREFIX}conn-AAA" (item_id, group_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?)`, [
      'item1',
      'group1',
      '2026-01-01',
      '{"x":1}',
      '2026-01-01T00:00:00.000Z'
    ]);

    await up(db);

    const rows = await db('south_item_cache').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].south_id, 'conn-AAA');
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[0].group_id, 'group1');
    assert.strictEqual(rows[0].tracked_instant, '2026-01-01T00:00:00.000Z');
  });

  it('drops the old per-connector table after copying', async () => {
    await createOldTable('conn-AAA');
    await up(db);
    assert.strictEqual(await db.schema.hasTable(`${PREFIX}conn-AAA`), false);
  });

  it('handles multiple connector tables', async () => {
    await createOldTable('conn-AAA');
    await createOldTable('conn-BBB');
    await db.raw(`INSERT INTO "${PREFIX}conn-AAA" (item_id, tracked_instant) VALUES (?, ?)`, ['itemA', '2026-01-01T00:00:00.000Z']);
    await db.raw(`INSERT INTO "${PREFIX}conn-BBB" (item_id, tracked_instant) VALUES (?, ?)`, ['itemB', '2026-01-02T00:00:00.000Z']);

    await up(db);

    const rows = await db('south_item_cache').orderBy('south_id').select('*');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].south_id, 'conn-AAA');
    assert.strictEqual(rows[0].item_id, 'itemA');
    assert.strictEqual(rows[1].south_id, 'conn-BBB');
    assert.strictEqual(rows[1].item_id, 'itemB');
    assert.strictEqual(await db.schema.hasTable(`${PREFIX}conn-AAA`), false);
    assert.strictEqual(await db.schema.hasTable(`${PREFIX}conn-BBB`), false);
  });

  it('is a no-op when there are no old tables (already migrated)', async () => {
    await up(db); // first run — creates table, no old tables
    await up(db); // second run — must not throw
    assert.ok(await db.schema.hasTable('south_item_cache'));
  });

  it('is a no-op when there are no old tables at all', async () => {
    await up(db);
    const rows = await db('south_item_cache').select('*');
    assert.strictEqual(rows.length, 0);
  });

  it('preserves null group_id and null tracked_instant', async () => {
    await createOldTable('conn-AAA');
    await db.raw(`INSERT INTO "${PREFIX}conn-AAA" (item_id, group_id, tracked_instant) VALUES (?, ?, ?)`, ['item1', null, null]);

    await up(db);

    const row = await db('south_item_cache').where({ south_id: 'conn-AAA', item_id: 'item1' }).first();
    assert.strictEqual(row.group_id, null);
    assert.strictEqual(row.tracked_instant, null);
  });

  it('down() is a no-op (migration is not reversible)', async () => {
    const result = await down(db);
    assert.strictEqual(result, undefined);
  });
});
