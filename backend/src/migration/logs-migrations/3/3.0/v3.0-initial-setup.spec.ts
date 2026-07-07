import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.0-initial-setup';

describe('Logs migration v3.0 (initial-setup)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  it('creates the logs table with the expected columns', async () => {
    await up(db);

    assert.ok(await db.schema.hasTable('logs'));
    const info = (await db.raw('PRAGMA table_info(logs)')) as Array<{ name: string; notnull: number }>;
    const columns = info.map(c => c.name);
    assert.deepStrictEqual(columns.sort(), ['level', 'message', 'scope_id', 'scope_name', 'scope_type', 'timestamp'].sort());

    const notNullCols = info.filter(c => c.notnull === 1).map(c => c.name);
    assert.deepStrictEqual(notNullCols.sort(), ['level', 'message', 'scope_type', 'timestamp'].sort());
  });

  it('allows inserting a row with all expected fields', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      scope_type: 'south',
      scope_id: 'south-1',
      scope_name: 'MQTT',
      message: 'connected'
    });

    const row = await db('logs').first();
    assert.strictEqual(row.level, 'info');
    assert.strictEqual(row.scope_type, 'south');
    assert.strictEqual(row.message, 'connected');
  });

  it('down is a no-op', async () => {
    await down(); // must not throw
    assert.ok(await db.schema.hasTable('logs'), 'table should still exist since down does nothing');
  });
});
