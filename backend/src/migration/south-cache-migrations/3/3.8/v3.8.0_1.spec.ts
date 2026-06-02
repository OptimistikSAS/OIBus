import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up } from './v3.8.0_1';

describe('South cache migration v3.8.0_1 (repair south_item_cache key)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw('DROP TABLE IF EXISTS "south_item_cache_AAA"');
    await db.raw('DROP TABLE IF EXISTS "south_item_cache_BBB"');
    await db.raw('DROP TABLE IF EXISTS "unrelated_table"');
  });

  /** Recreate the OLD, buggy schema: composite UNIQUE(item_id, group_id), no single-column PK. */
  async function createBrokenTable(name: string): Promise<void> {
    await db.schema.createTable(name, table => {
      table.string('item_id');
      table.string('group_id');
      table.datetime('query_time');
      table.text('value');
      table.datetime('tracked_instant');
      table.unique(['item_id', 'group_id']);
    });
  }

  it('collapses duplicate rows for a non-grouped item, keeping the latest tracked_instant', async () => {
    await createBrokenTable('south_item_cache_AAA');
    // Simulate the bug: every scan APPENDED a new row because group_id is NULL.
    await db('south_item_cache_AAA').insert([
      { item_id: 'item1', group_id: null, query_time: null, value: null, tracked_instant: '2026-06-01T00:00:00.000Z' },
      { item_id: 'item1', group_id: null, query_time: null, value: null, tracked_instant: '2026-06-02T08:16:32.000Z' },
      { item_id: 'item1', group_id: null, query_time: null, value: null, tracked_instant: '2026-06-02T10:00:00.000Z' }
    ]);

    await up(db);

    const rows = await db('south_item_cache_AAA').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[0].tracked_instant, '2026-06-02T10:00:00.000Z');
  });

  it('makes item_id the primary key so INSERT OR REPLACE now upserts instead of appending', async () => {
    await createBrokenTable('south_item_cache_AAA');
    await db('south_item_cache_AAA').insert({
      item_id: 'item1',
      group_id: null,
      query_time: null,
      value: null,
      tracked_instant: '2026-06-01T00:00:00.000Z'
    });

    await up(db);

    // Repository-style upsert with a NULL group_id must now REPLACE the existing row.
    await db.raw(
      'INSERT OR REPLACE INTO "south_item_cache_AAA" (group_id, item_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?)',
      [null, 'item1', null, null, '2026-06-03T12:00:00.000Z']
    );

    const rows = await db('south_item_cache_AAA').select('*');
    assert.strictEqual(rows.length, 1, 'upsert must not append a second row');
    assert.strictEqual(rows[0].tracked_instant, '2026-06-03T12:00:00.000Z');

    // Confirm the schema: item_id is the primary key.
    const info = (await db.raw('PRAGMA table_info("south_item_cache_AAA")')) as Array<{ name: string; pk: number }>;
    const itemIdCol = info.find(c => c.name === 'item_id');
    assert.ok(itemIdCol && itemIdCol.pk === 1, 'item_id must be the primary key');
  });

  it('keeps the most recent row for file connectors (tracked_instant NULL, growing value) via rowid', async () => {
    await createBrokenTable('south_item_cache_AAA');
    await db('south_item_cache_AAA').insert([
      { item_id: 'fileItem', group_id: null, query_time: null, value: JSON.stringify(['a.csv']), tracked_instant: null },
      { item_id: 'fileItem', group_id: null, query_time: null, value: JSON.stringify(['a.csv', 'b.csv']), tracked_instant: null }
    ]);

    await up(db);

    const rows = await db('south_item_cache_AAA').select('*');
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(JSON.parse(rows[0].value), ['a.csv', 'b.csv']);
  });

  it('handles multiple connector tables and ignores unrelated tables', async () => {
    await createBrokenTable('south_item_cache_AAA');
    await createBrokenTable('south_item_cache_BBB');
    await db.schema.createTable('unrelated_table', table => {
      table.string('id');
    });
    await db('south_item_cache_AAA').insert({ item_id: 'i1', group_id: null, tracked_instant: '2026-01-01T00:00:00.000Z' });
    await db('south_item_cache_BBB').insert({ item_id: 'i2', group_id: 'g1', tracked_instant: '2026-01-02T00:00:00.000Z' });

    await up(db);

    assert.strictEqual((await db('south_item_cache_AAA').select('*')).length, 1);
    assert.strictEqual((await db('south_item_cache_BBB').select('*')).length, 1);
    // Unrelated table untouched.
    assert.ok(await db.schema.hasTable('unrelated_table'));
  });

  it('is a no-op when there are no south_item_cache tables', async () => {
    await up(db); // must not throw
  });
});
