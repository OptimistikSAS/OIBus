/**
 * South-cache migration upgrade scenario.
 * Covers branches in v3.8.0-south-item-cache.ts that require pre-existing data:
 * - cache_history rows (connector ID discovery loop)
 * - folder_scanner_* / south_ftp_* tables (file-connector migration loop)
 * - per-connector table creation with data (rowsToInsert > 0 branch)
 * - oibus.db hints section: all conditional branches in lines 79-101
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import Database from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { up as v3_0_up } from './south-cache-migrations/3/3.0/v3.0-initial-setup';
import { up as v3_8_0_up } from './south-cache-migrations/3/3.8/v3.8.0-south-item-cache';

const MIGRATION_HINTS_TABLE = '_migration_v380_file_connector_hints';

describe('south-cache migration v3.8.0 upgrade scenario (pre-populated)', () => {
  it('migrates cache_history entries and legacy file-connector tables', async () => {
    const db = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
      await v3_0_up(db);

      const CONNECTOR_A = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';
      const CONNECTOR_B = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb';
      const SCAN_MODE = 'scan-mode-1';
      const ITEM_A1 = 'item-a-1';
      const ITEM_A2 = 'item-a-2';

      await db('cache_history').insert([
        { south_id: CONNECTOR_A, scan_mode_id: SCAN_MODE, item_id: ITEM_A1, max_instant: '2024-01-01T00:00:00.000Z' },
        { south_id: CONNECTOR_A, scan_mode_id: SCAN_MODE, item_id: ITEM_A2, max_instant: '2024-01-02T00:00:00.000Z' },
        { south_id: CONNECTOR_B, scan_mode_id: SCAN_MODE, item_id: 'all', max_instant: '2024-01-03T00:00:00.000Z' }
      ]);

      const FOLDER_CONNECTOR = 'cccccccc-0000-0000-0000-cccccccccccc';
      await db.schema.createTable(`folder_scanner_${FOLDER_CONNECTOR}`, t => {
        t.string('filename').primary();
        t.integer('mtime_ms');
      });
      await db(`folder_scanner_${FOLDER_CONNECTOR}`).insert([
        { filename: 'file1.csv', mtime_ms: 1_700_000_000_000 },
        { filename: 'file2.csv', mtime_ms: 1_700_000_100_000 }
      ]);

      const FTP_CONNECTOR = 'dddddddd-0000-0000-0000-dddddddddddd';
      await db.schema.createTable(`south_ftp_${FTP_CONNECTOR}`, t => {
        t.string('filename').primary();
        t.integer('mtime_ms');
      });

      await v3_8_0_up(db);

      assert.ok(await db.schema.hasTable(`south_item_cache_${CONNECTOR_A}`));
      const aRows = await db(`south_item_cache_${CONNECTOR_A}`).select('*');
      assert.strictEqual(aRows.length, 2);

      assert.ok(await db.schema.hasTable(`south_item_cache_${CONNECTOR_B}`));
      const bRows = await db(`south_item_cache_${CONNECTOR_B}`).select('*');
      assert.strictEqual(bRows.length, 1);
      assert.strictEqual(bRows[0].item_id, SCAN_MODE);

      assert.ok(await db.schema.hasTable(`south_item_cache_${FOLDER_CONNECTOR}`));
      assert.ok(!(await db.schema.hasTable('cache_history')));
      assert.ok(!(await db.schema.hasTable(`folder_scanner_${FOLDER_CONNECTOR}`)));
      assert.ok(!(await db.schema.hasTable(`south_ftp_${FTP_CONNECTOR}`)));
    } finally {
      await db.destroy();
    }
  });
});

describe('south-cache migration v3.8.0 with oibus.db hints (lines 79-101)', () => {
  let tmpDir: string;
  let origCwd: string;

  before(async () => {
    origCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-south-cache-hints-'));
    process.chdir(tmpDir);
  });

  after(async () => {
    process.chdir(origCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('processes oibus.db hints: covers all branches in the hints section', async () => {
    const FOLDER_CONNECTOR = 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee';
    const NO_FILES_CONNECTOR = 'ffffffff-0000-0000-0000-ffffffffffff';
    const SCAN_MODE = 'scan-mode-hints';

    // Use a file-based DB so it persists between the knex operations and Database reads.
    const dbPath = path.join(tmpDir, 'south-cache.db');
    const db = knex({ client: 'better-sqlite3', connection: { filename: dbPath }, useNullAsDefault: true });

    try {
      await v3_0_up(db);

      // cache_history entry so the per-connector table gets created with a row for item-1
      // (needed for the `if (existing)` TRUE branch)
      await db('cache_history').insert([
        { south_id: FOLDER_CONNECTOR, scan_mode_id: SCAN_MODE, item_id: 'file-item-1', max_instant: '2024-01-01T00:00:00.000Z' }
      ]);

      // folder_scanner table with files matching various regexes
      await db.schema.createTable(`folder_scanner_${FOLDER_CONNECTOR}`, t => {
        t.string('filename').primary();
        t.integer('mtime_ms');
      });
      await db(`folder_scanner_${FOLDER_CONNECTOR}`).insert([
        { filename: 'data_A.csv', mtime_ms: 1_700_000_000_000 },
        { filename: 'data_B.csv', mtime_ms: 1_700_000_100_000 }
      ]);

      // NO_FILES_CONNECTOR has NO folder_scanner table → connectorFiles will be empty (skip branch)

      // Create oibus.db with the hints table in tmpDir (CWD)
      const entityDb = new Database('oibus.db');
      entityDb.prepare(`CREATE TABLE "${MIGRATION_HINTS_TABLE}" (
        connector_id TEXT, item_id TEXT, preserve_files INTEGER, regex TEXT
      )`).run();

      // hint1: file-item-1 preserve_files=1, regex matches data_A.csv → UPDATE existing row
      entityDb.prepare(`INSERT INTO "${MIGRATION_HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run(
        FOLDER_CONNECTOR, 'file-item-1', 1, 'data_A\\.csv'
      );
      // hint2: file-item-2 preserve_files=1, regex matches data_B.csv → INSERT new row (no cache_history entry)
      entityDb.prepare(`INSERT INTO "${MIGRATION_HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run(
        FOLDER_CONNECTOR, 'file-item-2', 1, 'data_B\\.csv'
      );
      // hint3: preserve_files=0 → skipped by `if (!hint.preserve_files) continue`
      entityDb.prepare(`INSERT INTO "${MIGRATION_HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run(
        FOLDER_CONNECTOR, 'file-item-3', 0, '.*'
      );
      // hint4: regex matches nothing → filesPreserved.length === 0 → skip
      entityDb.prepare(`INSERT INTO "${MIGRATION_HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run(
        FOLDER_CONNECTOR, 'file-item-4', 1, 'nonexistent_file\\.csv'
      );
      // hint5: connector with no folder_scanner table → connectorFiles null → skip
      entityDb.prepare(`INSERT INTO "${MIGRATION_HINTS_TABLE}" VALUES (?, ?, ?, ?)`).run(
        NO_FILES_CONNECTOR, 'file-item-5', 1, '.*'
      );
      entityDb.close();

      // Run the migration
      await v3_8_0_up(db);

      // The per-connector table for FOLDER_CONNECTOR should exist
      assert.ok(await db.schema.hasTable(`south_item_cache_${FOLDER_CONNECTOR}`));

      // file-item-1 should have been UPDATED (value set to matched files)
      const item1Row = await db(`south_item_cache_${FOLDER_CONNECTOR}`)
        .where('item_id', 'file-item-1')
        .first();
      assert.ok(item1Row, 'file-item-1 row should exist (was in cache_history)');
      assert.ok(item1Row.value, 'file-item-1 should have value set by hints (UPDATE branch)');

      // file-item-2 should have been INSERTED (no cache_history entry, but hint matched)
      const item2Row = await db(`south_item_cache_${FOLDER_CONNECTOR}`)
        .where('item_id', 'file-item-2')
        .first();
      assert.ok(item2Row, 'file-item-2 row should exist (INSERT branch from hints)');
      assert.ok(item2Row.value, 'file-item-2 should have value set by hints (INSERT branch)');

      // The hints table should have been dropped
      assert.ok(!(await fs.access('oibus.db').then(() => false).catch(() => true)), 'oibus.db should still exist');
    } finally {
      await db.destroy();
    }
  });
});
