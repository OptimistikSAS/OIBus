import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up, down } from './v3.11.0';

describe('South cache migration v3.11.0 (dedicated caching-strategy columns)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw('DROP TABLE IF EXISTS "south_item_cache"');
  });

  async function createCurrentSchemaTable(): Promise<void> {
    await db.raw(
      'CREATE TABLE "south_item_cache" (' +
        'south_id TEXT NOT NULL, ' +
        'item_id TEXT, ' +
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

  it('adds cached_value and cached_instant columns, leaving value/tracked_instant untouched', async () => {
    await createCurrentSchemaTable();
    await db('south_item_cache').insert({
      south_id: 'south-1',
      item_id: 'item-1',
      group_id: null,
      query_time: '2026-01-01T00:00:00Z',
      value: '"legacy-value"',
      tracked_instant: '2026-01-01T00:00:00Z'
    });

    await up(db);

    const cols = ((await db.raw('PRAGMA table_info("south_item_cache")')) as Array<{ name: string }>).map(c => c.name);
    assert.ok(cols.includes('cached_value'));
    assert.ok(cols.includes('cached_instant'));

    const row = await db('south_item_cache').where({ south_id: 'south-1', item_id: 'item-1' }).first();
    assert.strictEqual(row.value, '"legacy-value"');
    assert.strictEqual(row.tracked_instant, '2026-01-01T00:00:00Z');
    assert.strictEqual(row.cached_value, null);
    assert.strictEqual(row.cached_instant, null);
  });

  it('down() removes the two new columns and does nothing when the table is missing', async () => {
    await createCurrentSchemaTable();
    await up(db);
    await down(db);
    const cols = ((await db.raw('PRAGMA table_info("south_item_cache")')) as Array<{ name: string }>).map(c => c.name);
    assert.ok(!cols.includes('cached_value'));
    assert.ok(!cols.includes('cached_instant'));

    await db.raw('DROP TABLE "south_item_cache"');
    await down(db); // must not throw
  });
});
