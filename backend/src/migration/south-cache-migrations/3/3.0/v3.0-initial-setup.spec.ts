import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.0-initial-setup';

describe('South cache migration v3.0 (initial-setup)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  it('creates the cache_history table with a composite primary key', async () => {
    await up(db);

    assert.ok(await db.schema.hasTable('cache_history'));
    const info = (await db.raw('PRAGMA table_info(cache_history)')) as Array<{ name: string; notnull: number; pk: number }>;
    const columns = info.map(c => c.name);
    assert.deepStrictEqual(columns.sort(), ['item_id', 'max_instant', 'scan_mode_id', 'south_id'].sort());

    const pkCols = info.filter(c => c.pk > 0).map(c => c.name);
    assert.deepStrictEqual(pkCols.sort(), ['item_id', 'scan_mode_id', 'south_id']);

    const maxInstantCol = info.find(c => c.name === 'max_instant');
    assert.strictEqual(maxInstantCol?.notnull, 0, 'max_instant should be nullable');
  });

  it('allows inserting a cache_history row', async () => {
    await db('cache_history').insert({
      south_id: 'south-1',
      scan_mode_id: 'scan-1',
      item_id: 'item-1',
      max_instant: '2025-01-01T00:00:00.000Z'
    });

    const row = await db('cache_history').first();
    assert.strictEqual(row.south_id, 'south-1');
    assert.strictEqual(row.scan_mode_id, 'scan-1');
    assert.strictEqual(row.item_id, 'item-1');
    assert.strictEqual(row.max_instant, '2025-01-01T00:00:00.000Z');
  });

  it('allows a null max_instant', async () => {
    await db('cache_history').insert({
      south_id: 'south-2',
      scan_mode_id: 'scan-2',
      item_id: 'item-2',
      max_instant: null
    });

    const row = await db('cache_history').where({ south_id: 'south-2' }).first();
    assert.strictEqual(row.max_instant, null);
  });

  it('drops the cache_history table on down', async () => {
    await down(db);
    assert.strictEqual(await db.schema.hasTable('cache_history'), false);
  });
});
