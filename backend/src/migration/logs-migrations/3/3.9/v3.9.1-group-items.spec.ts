import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { down, up } from './v3.9.1-group-items';

/**
 * Create the logs table as it exists immediately before this migration runs
 * (after v3.9.0: with item_id/item_name columns, without group_id/group_name).
 */
async function createLogsTable(db: Knex): Promise<void> {
  await db.schema.createTable('logs', table => {
    table.datetime('timestamp').notNullable();
    table.string('level').notNullable().defaultTo('');
    table.string('scope_type');
    table.text('scope_id');
    table.text('scope_name');
    table.text('item_id');
    table.text('item_name');
    table.text('message').notNullable();
  });
}

async function columnExists(db: Knex, columnName: string): Promise<boolean> {
  const info = (await db.raw(`PRAGMA table_info(logs)`)) as Array<{ name: string }>;
  return info.some(col => col.name === columnName);
}

async function indexExists(db: Knex, indexName: string): Promise<boolean> {
  const info = (await db.raw(`PRAGMA index_list(logs)`)) as Array<{ name: string }>;
  return info.some(idx => idx.name === indexName);
}

describe('Logs migration v3.9.1 (group-items)', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-logs-v391-'));
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

  it('adds group_id column after up', async () => {
    assert.equal(await columnExists(db, 'group_id'), false, 'group_id should not exist before migration');

    await up(db);

    assert.equal(await columnExists(db, 'group_id'), true, 'group_id should exist after migration');
  });

  it('adds group_name column after up', async () => {
    assert.equal(await columnExists(db, 'group_name'), false, 'group_name should not exist before migration');

    await up(db);

    assert.equal(await columnExists(db, 'group_name'), true, 'group_name should exist after migration');
  });

  it('new columns are nullable — existing rows get NULL for group_id and group_name', async () => {
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'info',
      scope_type: 'south',
      scope_id: 'south-1',
      scope_name: 'OPC-UA',
      item_id: null,
      item_name: null,
      message: 'querying items'
    });

    await up(db);

    const row = await db('logs').first();
    assert.strictEqual(row.group_id, null, 'group_id should be NULL for pre-existing rows');
    assert.strictEqual(row.group_name, null, 'group_name should be NULL for pre-existing rows');
  });

  it('clears scope_name for internal scope rows during up', async () => {
    await db('logs').insert([
      {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'info',
        scope_type: 'internal',
        scope_id: 'engine',
        scope_name: 'Engine',
        item_id: null,
        item_name: null,
        message: 'engine started'
      },
      {
        timestamp: '2025-01-01T00:01:00.000Z',
        level: 'info',
        scope_type: 'south',
        scope_id: 'south-1',
        scope_name: 'OPC-UA',
        item_id: null,
        item_name: null,
        message: 'south started'
      }
    ]);

    await up(db);

    const internalRow = await db('logs').where('scope_type', 'internal').first();
    assert.strictEqual(internalRow.scope_name, null, 'scope_name should be NULL for internal rows after migration');

    const southRow = await db('logs').where('scope_type', 'south').first();
    assert.strictEqual(southRow.scope_name, 'OPC-UA', 'scope_name should be preserved for non-internal rows');
  });

  it('creates idx_logs_group_id index after up', async () => {
    assert.equal(await indexExists(db, 'idx_logs_group_id'), false, 'index should not exist before migration');

    await up(db);

    assert.equal(await indexExists(db, 'idx_logs_group_id'), true, 'index should exist after migration');
  });

  it('removes group_id and group_name columns after down', async () => {
    await up(db);
    assert.equal(await columnExists(db, 'group_id'), true);
    assert.equal(await columnExists(db, 'group_name'), true);

    await down(db);

    assert.equal(await columnExists(db, 'group_id'), false, 'group_id should be removed after down');
    assert.equal(await columnExists(db, 'group_name'), false, 'group_name should be removed after down');
  });

  it('preserves existing data after down', async () => {
    await up(db);
    await db('logs').insert({
      timestamp: '2025-01-01T00:00:00.000Z',
      level: 'error',
      scope_type: 'south',
      scope_id: 'south-1',
      scope_name: 'OPC-UA',
      item_id: 'item-1',
      item_name: 'Pressure',
      group_id: null,
      group_name: null,
      message: 'query failed'
    });

    await down(db);

    const row = await db('logs').first();
    assert.strictEqual(row.level, 'error');
    assert.strictEqual(row.item_id, 'item-1');
    assert.strictEqual(row.item_name, 'Pressure');
  });
});
