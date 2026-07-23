import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { down, up } from './v3.7.1';

/**
 * Create the logs table as it exists immediately before this migration runs
 * (after v3.2.0: level/scope_type are plain strings already, with no default
 * value enforced at the column level — this migration re-applies notNullable
 * + defaultTo('') on both).
 */
async function createLogsTable(db: Knex): Promise<void> {
  await db.schema.createTable('logs', table => {
    table.datetime('timestamp').notNullable();
    table.string('level').notNullable();
    table.string('scope_type').notNullable().defaultTo('internal');
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });
}

async function columnExists(db: Knex, columnName: string): Promise<boolean> {
  const info = (await db.raw(`PRAGMA table_info(logs)`)) as Array<{ name: string }>;
  return info.some(col => col.name === columnName);
}

describe('Logs migration v3.7.1 (remove-logs-enum)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.schema.dropTableIfExists('logs');
    await createLogsTable(db);
  });

  it('replaces scope_type and level columns without leaving the temporary *_old columns behind', async () => {
    await up(db);

    assert.strictEqual(await columnExists(db, 'scope_type_old'), false, 'scope_type_old should be dropped');
    assert.strictEqual(await columnExists(db, 'level_old'), false, 'level_old should be dropped');
    assert.ok(await columnExists(db, 'scope_type'));
    assert.ok(await columnExists(db, 'level'));
  });

  it('preserves scope_type and level values for existing rows', async () => {
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
    assert.strictEqual(row.level, 'error');
    assert.strictEqual(row.scope_type, 'south');
    assert.strictEqual(row.scope_id, 'south-1');
    assert.strictEqual(row.scope_name, 'MQTT');
    assert.strictEqual(row.message, 'connection error');
  });

  it('handles multiple rows, preserving each row scope_type/level independently', async () => {
    await db('logs').insert([
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'info',
        scope_type: 'internal',
        scope_id: 'engine',
        scope_name: null,
        message: 'engine started'
      },
      {
        timestamp: '2025-01-01T00:01:00.000Z',
        level: 'debug',
        scope_type: 'north',
        scope_id: 'north-1',
        scope_name: 'OIA',
        message: 'sent batch'
      }
    ]);

    await up(db);

    const rows = await db('logs').orderBy('timestamp').select('*');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].level, 'info');
    assert.strictEqual(rows[0].scope_type, 'internal');
    assert.strictEqual(rows[1].level, 'debug');
    assert.strictEqual(rows[1].scope_type, 'north');
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
