import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import knex, { Knex } from 'knex';
import Database from 'better-sqlite3';
import { up } from './v3.8.0-south-item-cache';

const CACHE_HISTORY_TABLE = 'cache_history';
const HINTS_TABLE = '_migration_v380_file_connector_hints';

/** Create the v3.0 cache_history table (the only table that exists before this migration). */
async function createCacheHistory(db: Knex): Promise<void> {
  await db.schema.createTable(CACHE_HISTORY_TABLE, table => {
    table.string('south_id').notNullable();
    table.string('scan_mode_id').notNullable();
    table.string('item_id').notNullable();
    table.primary(['south_id', 'scan_mode_id', 'item_id']);
    table.datetime('max_instant');
  });
}

/** Create a legacy file-connector table (folder_scanner, south_ftp, south_sftp). */
async function createLegacyFileTable(db: Knex, tableName: string, rows: Array<{ filename: string; mtime_ms: number }> = []): Promise<void> {
  await db.schema.createTable(tableName, table => {
    table.string('filename');
    table.integer('mtime_ms');
  });
  if (rows.length > 0) {
    await db(tableName).insert(rows);
  }
}

/** Return the column names of a table, keyed by name → { pk }. */
async function tableInfo(db: Knex, tableName: string): Promise<Array<{ name: string; pk: number }>> {
  return (await db.raw(`PRAGMA table_info("${tableName}")`)) as Array<{ name: string; pk: number }>;
}

describe('South cache migration v3.8.0 (south-item-cache)', () => {
  let db: Knex;

  before(() => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  });

  after(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    // Drop everything created by a previous test.
    const tables = (await db.raw(`SELECT name FROM sqlite_master WHERE type='table'`)) as Array<{ name: string }>;
    for (const { name } of tables) {
      await db.schema.dropTableIfExists(name);
    }
  });

  // ─── Empty / no-op ─────────────────────────────────────────────────────────

  it('runs without error when the database is empty (no tables)', async () => {
    await up(db); // must not throw
  });

  it('runs without error when cache_history exists but has no rows', async () => {
    await createCacheHistory(db);
    await up(db); // must not throw
  });

  // ─── Per-connector table creation ──────────────────────────────────────────

  it('creates a south_item_cache table for each connector in cache_history', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert([
      { south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item1', max_instant: '2025-01-01T00:00:00.000Z' },
      { south_id: 'connB', scan_mode_id: 'sm2', item_id: 'item2', max_instant: '2025-01-02T00:00:00.000Z' }
    ]);

    await up(db);

    assert.ok(await db.schema.hasTable('south_item_cache_connA'), 'south_item_cache_connA should be created');
    assert.ok(await db.schema.hasTable('south_item_cache_connB'), 'south_item_cache_connB should be created');
  });

  it('gives the new table an item_id primary key', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert({ south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item1', max_instant: null });

    await up(db);

    const info = await tableInfo(db, 'south_item_cache_connA');
    const itemIdCol = info.find(c => c.name === 'item_id');
    assert.ok(itemIdCol && itemIdCol.pk === 1, 'item_id must be the primary key');
  });

  // ─── tracked_instant migration ──────────────────────────────────────────────

  it('migrates max_instant from cache_history into tracked_instant', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert({
      south_id: 'connA',
      scan_mode_id: 'sm1',
      item_id: 'item1',
      max_instant: '2025-06-01T08:00:00.000Z'
    });

    await up(db);

    const rows = await db('south_item_cache_connA').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[0].tracked_instant, '2025-06-01T08:00:00.000Z');
  });

  it('collapses duplicate item_ids to one row, keeping the latest tracked_instant', async () => {
    await createCacheHistory(db);
    // Three rows for the same item_id with different scan_mode_id (the old PK allowed this).
    await db(CACHE_HISTORY_TABLE).insert([
      { south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item1', max_instant: '2025-01-01T00:00:00.000Z' },
      { south_id: 'connA', scan_mode_id: 'sm2', item_id: 'item1', max_instant: '2025-06-04T12:00:00.000Z' },
      { south_id: 'connA', scan_mode_id: 'sm3', item_id: 'item1', max_instant: '2025-03-15T06:00:00.000Z' }
    ]);

    await up(db);

    const rows = await db('south_item_cache_connA').select('*');
    assert.strictEqual(rows.length, 1, 'duplicates should be collapsed to one row');
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[0].tracked_instant, '2025-06-04T12:00:00.000Z', 'should keep the latest instant');
  });

  it('uses scan_mode_id as item_id when item_id equals "all"', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert({
      south_id: 'connA',
      scan_mode_id: 'scanModeXYZ',
      item_id: 'all',
      max_instant: '2025-06-01T00:00:00.000Z'
    });

    await up(db);

    const rows = await db('south_item_cache_connA').select('*');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].item_id, 'scanModeXYZ', '"all" item_id should become the scan_mode_id');
  });

  it('migrates multiple items for the same connector', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert([
      { south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item1', max_instant: '2025-01-01T00:00:00.000Z' },
      { south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item2', max_instant: '2025-02-01T00:00:00.000Z' },
      { south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item3', max_instant: null }
    ]);

    await up(db);

    const rows = await db('south_item_cache_connA').orderBy('item_id').select('*');
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[0].item_id, 'item1');
    assert.strictEqual(rows[1].item_id, 'item2');
    assert.strictEqual(rows[2].item_id, 'item3');
    assert.strictEqual(rows[2].tracked_instant, null);
  });

  // ─── Legacy file tables ─────────────────────────────────────────────────────

  it('creates a south_item_cache table for connectors found only in legacy file tables', async () => {
    // No cache_history — connector discovered solely via folder_scanner table.
    await createLegacyFileTable(db, 'folder_scanner_fileConn', [{ filename: 'report.csv', mtime_ms: 1700000000000 }]);

    await up(db);

    assert.ok(await db.schema.hasTable('south_item_cache_fileConn'), 'table should be created for file connector');
  });

  it('drops legacy file connector tables after migration', async () => {
    await createLegacyFileTable(db, 'folder_scanner_connX');
    await createLegacyFileTable(db, 'south_ftp_connY');
    await createLegacyFileTable(db, 'south_sftp_connZ');

    await up(db);

    assert.equal(await db.schema.hasTable('folder_scanner_connX'), false, 'folder_scanner table should be dropped');
    assert.equal(await db.schema.hasTable('south_ftp_connY'), false, 'south_ftp table should be dropped');
    assert.equal(await db.schema.hasTable('south_sftp_connZ'), false, 'south_sftp table should be dropped');
  });

  it('drops cache_history after migration', async () => {
    await createCacheHistory(db);
    await db(CACHE_HISTORY_TABLE).insert({ south_id: 'connA', scan_mode_id: 'sm1', item_id: 'item1', max_instant: null });

    await up(db);

    assert.equal(await db.schema.hasTable(CACHE_HISTORY_TABLE), false, 'cache_history should be dropped');
  });

  // ─── oibus.db hints integration ─────────────────────────────────────────────

  it('does not throw when oibus.db is absent (silently skips hints)', async () => {
    await createCacheHistory(db);
    await up(db); // must not throw even with no oibus.db nearby
  });

  it('populates value from legacy file table rows when hints are present in oibus.db', async () => {
    // This test creates a temporary oibus.db with the hints table in a temp directory,
    // then temporarily changes CWD so path.resolve('oibus.db') points to it.
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-sch-hints-'));
    const entityDbPath = path.join(tmpDir, 'oibus.db');
    const originalCwd = process.cwd();

    try {
      // Set up the entity DB (oibus.db) with a hints table.
      const entityDb = new Database(entityDbPath);
      entityDb.prepare(`CREATE TABLE "${HINTS_TABLE}" (connector_id TEXT, item_id TEXT, preserve_files INTEGER, regex TEXT)`).run();
      entityDb.prepare(`INSERT INTO "${HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run('fileConn', 'itemA', 1, '.*\\.csv$');
      entityDb.close();

      // Set up the cache DB: a legacy file table with two files (one matches the regex).
      await createLegacyFileTable(db, 'folder_scanner_fileConn', [
        { filename: 'report.csv', mtime_ms: 1700000000000 },
        { filename: 'image.png', mtime_ms: 1700000001000 }
      ]);

      // Change CWD so path.resolve('oibus.db') finds our temp file.
      process.chdir(tmpDir);
      await up(db);
    } finally {
      process.chdir(originalCwd);
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    const rows = await db('south_item_cache_fileConn').where({ item_id: 'itemA' }).select('*');
    assert.strictEqual(rows.length, 1, 'item row should have been created');
    const value = JSON.parse(rows[0].value) as Array<{ filename: string; modifiedTime: number }>;
    assert.strictEqual(value.length, 1, 'only the CSV file should match the regex');
    assert.strictEqual(value[0].filename, 'report.csv');
    assert.strictEqual(value[0].modifiedTime, 1700000000000);
  });

  it('returns early without error when oibus.db exists but has no hints table', async () => {
    // oibus.db is present (so `new Database(..., { fileMustExist: true })` succeeds and the
    // `try` block is entered) but the hints table itself is absent, exercising the
    // `if (!hintsExist) return;` branch rather than the catch-block path.
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-sch-nohints-'));
    const entityDbPath = path.join(tmpDir, 'oibus.db');
    const originalCwd = process.cwd();

    try {
      const entityDb = new Database(entityDbPath);
      entityDb.prepare(`CREATE TABLE some_other_table (id INTEGER)`).run();
      entityDb.close();

      await createLegacyFileTable(db, 'folder_scanner_fileConn', [{ filename: 'report.csv', mtime_ms: 1700000000000 }]);

      process.chdir(tmpDir);
      await up(db); // must not throw and must return early after finding no hints table
    } finally {
      process.chdir(originalCwd);
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    // The south_item_cache table for the file connector should exist (from step 3),
    // but no value should have been populated from hints since there were none.
    const rows = await db('south_item_cache_fileConn').select('*');
    assert.strictEqual(rows.length, 0, 'no rows should be inserted since there was no hints table to read');
  });

  it('drops the hints table from oibus.db once consumed', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-sch-drop-'));
    const entityDbPath = path.join(tmpDir, 'oibus.db');
    const originalCwd = process.cwd();

    try {
      const entityDb = new Database(entityDbPath);
      entityDb.prepare(`CREATE TABLE "${HINTS_TABLE}" (connector_id TEXT, item_id TEXT, preserve_files INTEGER, regex TEXT)`).run();
      entityDb.close();

      process.chdir(tmpDir);
      await up(db);
    } finally {
      process.chdir(originalCwd);
    }

    // Verify the hints table has been dropped from oibus.db.
    const entityDb = new Database(entityDbPath, { readonly: true });
    try {
      const row = entityDb.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(HINTS_TABLE);
      assert.equal(row, undefined, 'hints table should have been dropped from oibus.db after migration');
    } finally {
      entityDb.close();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
