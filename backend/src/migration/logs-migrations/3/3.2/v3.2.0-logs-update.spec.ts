import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { up as up30 } from '../3.0/v3.0-initial-setup';
import { down, up } from './v3.2.0-logs-update';

describe('Logs migration v3.2.0 (logs-update)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.schema.dropTableIfExists('logs');
    await db.schema.dropTableIfExists('logs_dg_tmp');
    await up30(db); // build the logs table as it exists before this migration
  });

  it('rebuilds the logs table keeping the same columns', async () => {
    await up(db);

    assert.ok(await db.schema.hasTable('logs'));
    assert.strictEqual(await db.schema.hasTable('logs_dg_tmp'), false, 'temp table should be dropped');

    const info = (await db.raw('PRAGMA table_info(logs)')) as Array<{ name: string }>;
    const columns = info.map(c => c.name);
    assert.deepStrictEqual(columns.sort(), ['level', 'message', 'scope_id', 'scope_name', 'scope_type', 'timestamp'].sort());
  });

  it('maps legacy scope_type values (engine, data-stream, history-engine, logger-service) to internal', async () => {
    await db('logs').insert([
      { timestamp: '2025-01-01T00:00:00.000Z', level: 'info', scope_type: 'engine', scope_id: null, scope_name: null, message: 'm1' },
      {
        timestamp: '2025-01-01T00:01:00.000Z',
        level: 'info',
        scope_type: 'data-stream',
        scope_id: null,
        scope_name: null,
        message: 'm2'
      },
      {
        timestamp: '2025-01-01T00:02:00.000Z',
        level: 'info',
        scope_type: 'history-engine',
        scope_id: null,
        scope_name: null,
        message: 'm3'
      },
      {
        timestamp: '2025-01-01T00:03:00.000Z',
        level: 'info',
        scope_type: 'logger-service',
        scope_id: null,
        scope_name: null,
        message: 'm4'
      }
    ]);

    await up(db);

    const rows = await db('logs').select('message', 'scope_type').orderBy('message');
    for (const row of rows) {
      assert.strictEqual(row.scope_type, 'internal', `scope_type for ${row.message} should be mapped to internal`);
    }
  });

  it('leaves non-legacy scope_type values (e.g. south) untouched', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'error',
      scope_type: 'south',
      scope_id: 'south-1',
      scope_name: 'MQTT',
      message: 'connection error'
    });

    await up(db);

    const row = await db('logs').first();
    assert.strictEqual(row.scope_type, 'south');
    assert.strictEqual(row.scope_id, 'south-1');
    assert.strictEqual(row.scope_name, 'MQTT');
    assert.strictEqual(row.message, 'connection error');
    assert.strictEqual(row.level, 'error');
  });

  it('preserves timestamp, level, scope_id, scope_name and message for every row', async () => {
    await db('logs').insert({
      timestamp: '2025-06-15T10:00:00.000Z',
      level: 'warn',
      scope_type: 'north',
      scope_id: 'north-1',
      scope_name: 'OIA',
      message: 'buffer high'
    });

    await up(db);

    const row = await db('logs').first();
    assert.strictEqual(row.timestamp, '2025-06-15T10:00:00.000Z');
    assert.strictEqual(row.level, 'warn');
    assert.strictEqual(row.scope_id, 'north-1');
    assert.strictEqual(row.scope_name, 'OIA');
    assert.strictEqual(row.message, 'buffer high');
  });

  it('works on an empty logs table', async () => {
    await up(db); // must not throw
    const rows = await db('logs').select('*');
    assert.strictEqual(rows.length, 0);
  });

  it('down is a no-op', async () => {
    await down(); // must not throw
    assert.ok(await db.schema.hasTable('logs'));
  });
});
