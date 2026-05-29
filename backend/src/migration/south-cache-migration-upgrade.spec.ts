/**
 * South-cache migration upgrade scenario.
 * Covers branches in v3.8.0-south-item-cache.ts that require pre-existing data:
 * - cache_history rows (connector ID discovery loop)
 * - folder_scanner_* / south_ftp_* tables (file-connector migration loop)
 * - per-connector table creation with data (rowsToInsert > 0 branch)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import { up as v3_0_up } from './south-cache-migrations/3/3.0/v3.0-initial-setup';
import { up as v3_8_0_up } from './south-cache-migrations/3/3.8/v3.8.0-south-item-cache';

describe('south-cache migration v3.8.0 upgrade scenario (pre-populated)', () => {
  it('migrates cache_history entries and legacy file-connector tables', async () => {
    const db = knex({ client: 'better-sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
      // Run v3.0 to create the cache_history table
      await v3_0_up(db);

      // Insert cache_history rows for two connectors
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

      // Create a folder_scanner legacy table (file connector that used old per-connector table)
      const FOLDER_CONNECTOR = 'cccccccc-0000-0000-0000-cccccccccccc';
      await db.schema.createTable(`folder_scanner_${FOLDER_CONNECTOR}`, t => {
        t.string('filename').primary();
        t.integer('mtime_ms');
      });
      await db(`folder_scanner_${FOLDER_CONNECTOR}`).insert([
        { filename: 'file1.csv', mtime_ms: 1_700_000_000_000 },
        { filename: 'file2.csv', mtime_ms: 1_700_000_100_000 }
      ]);

      // Create a south_ftp legacy table (another file connector type)
      const FTP_CONNECTOR = 'dddddddd-0000-0000-0000-dddddddddddd';
      await db.schema.createTable(`south_ftp_${FTP_CONNECTOR}`, t => {
        t.string('filename').primary();
        t.integer('mtime_ms');
      });

      // Run the migration
      await v3_8_0_up(db);

      // connector A's per-connector table should have been created with migrated entries
      assert.ok(await db.schema.hasTable(`south_item_cache_${CONNECTOR_A}`), 'per-connector table for A should exist');
      const aRows = await db(`south_item_cache_${CONNECTOR_A}`).select('*');
      assert.strictEqual(aRows.length, 2, 'connector A should have 2 item cache entries');

      // connector B had an "all" item_id — it should have been remapped to scan_mode_id
      assert.ok(await db.schema.hasTable(`south_item_cache_${CONNECTOR_B}`), 'per-connector table for B should exist');
      const bRows = await db(`south_item_cache_${CONNECTOR_B}`).select('*');
      assert.strictEqual(bRows.length, 1);
      assert.strictEqual(bRows[0].item_id, SCAN_MODE, '"all" item_id should be remapped to scan_mode_id');

      // folder connector's per-connector table should exist (connector ID extracted from table name)
      assert.ok(await db.schema.hasTable(`south_item_cache_${FOLDER_CONNECTOR}`), 'per-connector table for folder connector should exist');

      // Old tables should be gone
      assert.ok(!(await db.schema.hasTable('cache_history')), 'cache_history should have been dropped');
      assert.ok(!(await db.schema.hasTable(`folder_scanner_${FOLDER_CONNECTOR}`)), 'legacy folder_scanner table should be dropped');
      assert.ok(!(await db.schema.hasTable(`south_ftp_${FTP_CONNECTOR}`)), 'legacy south_ftp table should be dropped');
    } finally {
      await db.destroy();
    }
  });
});
