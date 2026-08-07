import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up } from './v3.9.0_2';

describe('South cache migration v3.9.0_2 (nullable item_id, collapse batched-group rows)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw('DROP TABLE IF EXISTS "south_item_cache"');
    await db.raw('DROP TABLE IF EXISTS "tmp_south_item_cache"');
  });

  async function createCurrentSchemaTable(): Promise<void> {
    await db.raw(
      'CREATE TABLE "south_item_cache" (' +
        'south_id TEXT NOT NULL, ' +
        'item_id TEXT NOT NULL, ' +
        'group_id TEXT, ' +
        'query_time TEXT, ' +
        'value TEXT, ' +
        'tracked_instant TEXT, ' +
        'PRIMARY KEY (south_id, item_id)' +
        ')'
    );
  }

  it('does nothing when the table does not exist yet', async () => {
    await up(db);
    assert.strictEqual(await db.schema.hasTable('south_item_cache'), false);
  });

  it('keeps ungrouped/unsynced/single-item rows untouched', async () => {
    await createCurrentSchemaTable();
    await db('south_item_cache').insert([
      { south_id: 'south1', item_id: 'item1', group_id: null, query_time: null, value: null, tracked_instant: '2026-06-01T00:00:00.000Z' },
      { south_id: 'south1', item_id: 'item2', group_id: null, query_time: null, value: null, tracked_instant: '2026-06-02T00:00:00.000Z' }
    ]);

    await up(db);

    const rows = await db('south_item_cache').select('*').orderBy('item_id');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[0].group_id, null);
    assert.strictEqual(rows[1].item_id, 'item2');
  });

  it('nulls out item_id on an old-style batched-group row, keeping group_id and tracked_instant', async () => {
    await createCurrentSchemaTable();
    await db('south_item_cache').insert({
      south_id: 'south1',
      item_id: 'lead-item',
      group_id: 'group1',
      query_time: '2026-06-01T00:00:00.000Z',
      value: JSON.stringify({ foo: 'bar' }),
      tracked_instant: '2026-06-01T00:00:00.000Z'
    });

    await up(db);

    const rows = await db('south_item_cache').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, null);
    assert.strictEqual(rows[0].group_id, 'group1');
    assert.strictEqual(rows[0].tracked_instant, '2026-06-01T00:00:00.000Z');
  });

  it('collapses duplicate rows left behind by a lead-item change, keeping the latest tracked_instant', async () => {
    await createCurrentSchemaTable();
    // Two historical leads for the same group, from before this fix, left two rows behind.
    await db('south_item_cache').insert([
      {
        south_id: 'south1',
        item_id: 'old-lead',
        group_id: 'group1',
        query_time: null,
        value: null,
        tracked_instant: '2026-06-01T00:00:00.000Z'
      },
      {
        south_id: 'south1',
        item_id: 'new-lead',
        group_id: 'group1',
        query_time: null,
        value: null,
        tracked_instant: '2026-06-05T00:00:00.000Z'
      }
    ]);

    await up(db);

    const rows = await db('south_item_cache').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, null);
    assert.strictEqual(rows[0].group_id, 'group1');
    assert.strictEqual(rows[0].tracked_instant, '2026-06-05T00:00:00.000Z');
  });

  it('allows a NULL item_id and a real item_id to coexist for the same south_id without PK conflict', async () => {
    await createCurrentSchemaTable();
    await db('south_item_cache').insert([
      {
        south_id: 'south1',
        item_id: 'lead-item',
        group_id: 'group1',
        query_time: null,
        value: null,
        tracked_instant: '2026-06-01T00:00:00.000Z'
      },
      {
        south_id: 'south1',
        item_id: 'standalone-item',
        group_id: null,
        query_time: null,
        value: null,
        tracked_instant: '2026-06-01T00:00:00.000Z'
      }
    ]);

    await up(db);

    const rows = await db('south_item_cache').select('*').orderBy('group_id');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].group_id, null);
    assert.strictEqual(rows[0].item_id, 'standalone-item');
    assert.strictEqual(rows[1].group_id, 'group1');
    assert.strictEqual(rows[1].item_id, null);
  });

  it('is idempotent when run twice in a row', async () => {
    await createCurrentSchemaTable();
    await db('south_item_cache').insert({
      south_id: 'south1',
      item_id: 'lead-item',
      group_id: 'group1',
      query_time: null,
      value: null,
      tracked_instant: '2026-06-01T00:00:00.000Z'
    });

    await up(db);
    await up(db);

    const rows = await db('south_item_cache').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, null);
    assert.strictEqual(rows[0].group_id, 'group1');
  });
});
