import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { down, up } from './v3.9.0-scope-items';

/**
 * Create the logs table as it exists immediately before this migration runs
 * (after v3.8.0: with indexes, without item_id/item_name columns).
 */
async function createLogsTable(db: Knex): Promise<void> {
  await db.schema.createTable('logs', table => {
    table.datetime('timestamp').notNullable();
    table.string('level').notNullable().defaultTo('');
    table.string('scope_type').notNullable().defaultTo('');
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });
}

async function columnExists(db: Knex, columnName: string): Promise<boolean> {
  const info = (await db.raw(`PRAGMA table_info(logs)`)) as Array<{ name: string }>;
  return info.some(col => col.name === columnName);
}

describe('Logs migration v3.9.0 (scope-items)', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-logs-v390-'));
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
    await createLogsTable(db);
  });

  // ─── up: column additions ──────────────────────────────────────────────────

  it('adds item_id column after up', async () => {
    assert.equal(await columnExists(db, 'item_id'), false, 'item_id should not exist before migration');

    await up(db);

    assert.equal(await columnExists(db, 'item_id'), true, 'item_id should exist after migration');
  });

  it('adds item_name column after up', async () => {
    assert.equal(await columnExists(db, 'item_name'), false, 'item_name should not exist before migration');

    await up(db);

    assert.equal(await columnExists(db, 'item_name'), true, 'item_name should exist after migration');
  });

  it('new columns are nullable — existing rows get NULL for item_id and item_name', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      scope_type: 'south',
      scope_id: 'south-1',
      scope_name: 'MQTT',
      message: 'connected'
    });

    await up(db);

    const row = await db('logs').first();
    assert.strictEqual(row.item_id, null, 'item_id should be NULL for pre-existing rows');
    assert.strictEqual(row.item_name, null, 'item_name should be NULL for pre-existing rows');
  });

  // ─── up: web-server scope migration ───────────────────────────────────────

  it('converts scope_type=web-server rows to internal with scope_id=web-server', async () => {
    await db('logs').insert([
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'info',
        scope_type: 'web-server',
        scope_id: null,
        scope_name: null,
        message: 'request received'
      },
      {
        timestamp: '2025-01-01T00:01:00.000Z',
        level: 'error',
        scope_type: 'south',
        scope_id: 'south-1',
        scope_name: 'MQTT',
        message: 'connection error'
      }
    ]);

    await up(db);

    const webServerRow = await db('logs').where('message', 'request received').first();
    assert.strictEqual(webServerRow.scope_type, 'internal', 'scope_type should be internal after migration');
    assert.strictEqual(webServerRow.scope_id, 'web-server', 'scope_id should be web-server after migration');
    assert.strictEqual(webServerRow.scope_name, 'Web Server', 'scope_name should be Web Server after migration');

    const southRow = await db('logs').where('message', 'connection error').first();
    assert.strictEqual(southRow.scope_type, 'south', 'non-web-server rows should be untouched');
  });

  it('leaves non-web-server rows untouched during up', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      scope_type: 'internal',
      scope_id: 'engine',
      scope_name: 'Engine',
      message: 'started'
    });

    await up(db);

    const row = await db('logs').first();
    assert.strictEqual(row.scope_type, 'internal');
    assert.strictEqual(row.scope_id, 'engine');
    assert.strictEqual(row.scope_name, 'Engine');
  });

  it('works on an empty logs table', async () => {
    await up(db); // must not throw
  });

  // ─── down: web-server revert ───────────────────────────────────────────────

  it('reverts internal+web-server rows back to scope_type=web-server on down', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      scope_type: 'internal',
      scope_id: 'web-server',
      scope_name: 'Web Server',
      message: 'request received'
    });

    await down(db);

    const row = await db('logs').first();
    assert.strictEqual(row.scope_type, 'web-server');
    assert.strictEqual(row.scope_id, null);
    assert.strictEqual(row.scope_name, null);
  });

  it('removes item_id and item_name columns on down', async () => {
    await up(db);
    assert.equal(await columnExists(db, 'item_id'), true, 'item_id should exist before down');

    await down(db);

    assert.equal(await columnExists(db, 'item_id'), false, 'item_id should be dropped after down');
    assert.equal(await columnExists(db, 'item_name'), false, 'item_name should be dropped after down');
  });

  // ─── Reversibility ─────────────────────────────────────────────────────────

  it('is reversible: up → down → up', async () => {
    await up(db);
    await down(db);
    await up(db);

    assert.equal(await columnExists(db, 'item_id'), true, 'item_id should exist after up → down → up');
    assert.equal(await columnExists(db, 'item_name'), true, 'item_name should exist after up → down → up');
  });
});
