import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.9.0';
import { buildNorthEntity, buildSouthEntity, createHistoryQuery, createNorth, createSouth } from '../../../../tests/utils/test-utils';
import testData from '../../../../tests/utils/test-data';
import {
  SouthFolderScannerSettings,
  SouthMSSQLSettings,
  SouthItemSettings,
  SouthSettings
} from '../../../../../shared/model/south-settings.model';
import { NorthFileWriterSettings, NorthSettings } from '../../../../../shared/model/north-settings.model';

/**
 * Collect every entity migration file (excluding specs) under the entity-migrations root,
 * sorted lexicographically by filename — the same order OIBus's migration runner uses.
 */
function entityMigrationFiles(): Array<{ file: string; full: string }> {
  const root = path.resolve(__dirname, '..', '..'); // .../entity-migrations
  const collect = (base: string): Array<{ file: string; full: string }> => {
    const out: Array<{ file: string; full: string }> = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) {
        out.push(...collect(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        out.push({ file: entry.name, full });
      }
    }
    return out;
  };
  return collect(root).sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0));
}

/** Build the real schema as it exists just before v3.9.0 by running every prior migration in order. */
async function buildPreV390Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.9.0');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({
    id,
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *',
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthConnector(db: Knex, id = 'south-1', type = 'mssql') {
  await db('south_connectors').insert({
    id,
    name: `Test ${type}`,
    type,
    description: '',
    enabled: 1,
    settings: '{}',
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.9.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v390-'));
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
    await buildPreV390Schema(db);
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
      log_console_level: 'silent',
      log_file_level: 'silent',
      log_file_max_file_size: 50,
      log_file_number_of_files: 5,
      log_database_level: 'silent',
      log_database_max_number_of_logs: 100000,
      log_loki_level: 'silent',
      log_loki_interval: 60,
      log_oia_level: 'silent',
      log_oia_interval: 10,
      proxy_enabled: 0,
      proxy_port: 9000,
      oibus_version: '3.8.0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  it('runs end-to-end on a realistic pre-3.9.0 schema', async () => {
    await up(db); // must not throw
  });

  describe('engines syslog and proxy columns', () => {
    it('creates the table with the expected columns', async () => {
      await up(db);
      const cols = await columnNames(db, 'engines');
      assert.ok(cols.includes('log_syslog_level'), 'engines.log_syslog_level added');
      assert.ok(cols.includes('log_syslog_host'), 'engines.log_syslog_host added');
      assert.ok(cols.includes('log_syslog_port'), 'engines.log_syslog_port added');
      assert.ok(cols.includes('log_syslog_protocol'), 'engines.log_syslog_protocol added');
      assert.ok(cols.includes('forward_proxy_url'), 'engines.forward_proxy_url added');
      assert.ok(cols.includes('forward_proxy_username'), 'engines.forward_proxy_username added');
      assert.ok(cols.includes('forward_proxy_password'), 'engines.forward_proxy_password added');
      assert.ok(cols.includes('proxy_username'), 'engines.proxy_username added');
      assert.ok(cols.includes('proxy_password'), 'engines.proxy_password added');
    });

    it('leaves proxy auth columns null by default', async () => {
      await up(db);
      const row = await db('engines').first();
      assert.strictEqual(row.proxy_username, null);
      assert.strictEqual(row.proxy_password, null);
    });

    it('populates syslog defaults on existing rows', async () => {
      const row = await db('engines').first();
      await up(db);
      const updated = await db('engines').where('id', row.id).first();
      assert.strictEqual(updated.log_syslog_level, 'silent');
      assert.strictEqual(updated.log_syslog_host, '');
      assert.strictEqual(updated.log_syslog_port, 514);
      assert.strictEqual(updated.log_syslog_protocol, 'udp4');
    });

    it('leaves forward proxy columns null by default', async () => {
      await up(db);
      const row = await db('engines').first();
      assert.strictEqual(row.forward_proxy_url, null);
      assert.strictEqual(row.forward_proxy_username, null);
      assert.strictEqual(row.forward_proxy_password, null);
    });
  });

  describe('recovery_strategy column', () => {
    it('adds recovery_strategy column to south_item_groups', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_item_groups');
      assert.ok(cols.includes('recovery_strategy'), 'south_item_groups.recovery_strategy added');
    });

    it('adds recovery_strategy column to south_items', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_items');
      assert.ok(cols.includes('recovery_strategy'), 'south_items.recovery_strategy added');
    });

    it("sets recovery_strategy to 'oldest' for existing rows of a history-capable connector", async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'mssql');
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: 0,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: null,
        settings: '{}',
        sync_with_group: 1,
        max_read_interval: null,
        read_delay: null,
        overlap: null,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.recovery_strategy, 'oldest', "history-capable connector's group row defaults to 'oldest'");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.recovery_strategy, 'oldest', "history-capable connector's item row defaults to 'oldest'");
    });

    it('leaves recovery_strategy null for existing rows of a non-history-capable connector', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'mqtt');
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: 0,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: null,
        settings: '{}',
        sync_with_group: 1,
        max_read_interval: null,
        read_delay: null,
        overlap: null,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.recovery_strategy, null, "non-history-capable connector's group row stays null");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.recovery_strategy, null, "non-history-capable connector's item row stays null");
    });
  });

  describe('start_time_offset / end_time_offset replacing overlap', () => {
    it('up adds start_time_offset and end_time_offset to south_item_groups', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_item_groups');
      assert.ok(cols.includes('start_time_offset'), 'south_item_groups.start_time_offset added');
      assert.ok(cols.includes('end_time_offset'), 'south_item_groups.end_time_offset added');
    });

    it('up adds start_time_offset and end_time_offset to south_items', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_items');
      assert.ok(cols.includes('start_time_offset'), 'south_items.start_time_offset added');
      assert.ok(cols.includes('end_time_offset'), 'south_items.end_time_offset added');
    });

    it('up drops overlap from south_item_groups and south_items', async () => {
      await up(db);
      const groupCols = await columnNames(db, 'south_item_groups');
      assert.ok(!groupCols.includes('overlap'), 'south_item_groups.overlap removed');
      const itemCols = await columnNames(db, 'south_items');
      assert.ok(!itemCols.includes('overlap'), 'south_items.overlap removed');
    });

    it('up maps overlap to -start_time_offset for groups with non-null overlap', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db);
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: 500,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.start_time_offset, -500, 'start_time_offset = -overlap');
      assert.strictEqual(group.end_time_offset, 0, 'end_time_offset defaults to null');
    });

    it('up maps overlap to -start_time_offset for items with non-null overlap', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db);
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        settings: '{}',
        sync_with_group: 0,
        max_read_interval: null,
        read_delay: null,
        overlap: 1000,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.start_time_offset, -1000, 'start_time_offset = -overlap');
      assert.strictEqual(item.end_time_offset, 0, 'end_time_offset defaults to null');
    });

    it('up defaults start_time_offset/end_time_offset to 0 for a history-capable connector when overlap was null', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'mssql');
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: null,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        settings: '{}',
        sync_with_group: 0,
        max_read_interval: null,
        read_delay: null,
        overlap: null,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.start_time_offset, 0, 'null overlap → 0 start_time_offset for a history-capable group');
      assert.strictEqual(group.end_time_offset, 0, 'null overlap → 0 end_time_offset for a history-capable group');

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.start_time_offset, 0, 'null overlap → 0 start_time_offset for a history-capable item');
      assert.strictEqual(item.end_time_offset, 0, 'null overlap → 0 end_time_offset for a history-capable item');
    });

    it('up leaves start_time_offset/end_time_offset null for a non-history-capable connector', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'mqtt');
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: null,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        settings: '{}',
        sync_with_group: 0,
        max_read_interval: null,
        read_delay: null,
        overlap: null,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.start_time_offset, null, 'non-history-capable group start_time_offset stays null');
      assert.strictEqual(group.end_time_offset, null, 'non-history-capable group end_time_offset stays null');

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.start_time_offset, null, 'non-history-capable item start_time_offset stays null');
      assert.strictEqual(item.end_time_offset, null, 'non-history-capable item end_time_offset stays null');
    });

    it('down restores overlap column and drops start_time_offset, end_time_offset and recovery_strategy', async () => {
      await up(db);
      await down(db);

      const groupCols = await columnNames(db, 'south_item_groups');
      assert.ok(groupCols.includes('overlap'), 'south_item_groups.overlap restored');
      assert.ok(!groupCols.includes('start_time_offset'), 'south_item_groups.start_time_offset removed');
      assert.ok(!groupCols.includes('end_time_offset'), 'south_item_groups.end_time_offset removed');
      assert.ok(!groupCols.includes('recovery_strategy'), 'south_item_groups.recovery_strategy removed');

      const itemCols = await columnNames(db, 'south_items');
      assert.ok(itemCols.includes('overlap'), 'south_items.overlap restored');
      assert.ok(!itemCols.includes('start_time_offset'), 'south_items.start_time_offset removed');
      assert.ok(!itemCols.includes('end_time_offset'), 'south_items.end_time_offset removed');
      assert.ok(!itemCols.includes('recovery_strategy'), 'south_items.recovery_strategy removed');
    });

    it('down maps start_time_offset back to -overlap', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db);
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group A',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: 500,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item A',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        settings: '{}',
        sync_with_group: 0,
        max_read_interval: null,
        read_delay: null,
        overlap: 1000,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);
      await down(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.overlap, 500, 'group overlap restored to original value');

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.overlap, 1000, 'item overlap restored to original value');
    });
  });

  describe('SMB auth defaults for folder-scanner south / file-writer north', () => {
    it('backfills username/password/domain as null for a folder-scanner south connector missing them', async () => {
      const south = buildSouthEntity<SouthFolderScannerSettings, SouthItemSettings>(
        'folder-scanner',
        { inputFolder: 'input', compression: false, username: null, password: null, domain: null },
        []
      );
      south.id = 'folder-scanner-1';
      await createSouth(db, south);
      // Simulate a pre-3.9.0 row: the settings JSON predates the SMB auth fields entirely.
      await db('south_connectors')
        .where('id', south.id)
        .update({ settings: JSON.stringify({ inputFolder: 'input', compression: false }) });

      await up(db);

      const row = await db('south_connectors').where('id', 'folder-scanner-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.inputFolder, 'input', 'existing settings are preserved');
      assert.strictEqual(settings.username, null);
      assert.strictEqual(settings.password, null);
      assert.strictEqual(settings.domain, null);
    });

    it('preserves existing username/password/domain for a folder-scanner south connector that already has them', async () => {
      const south = buildSouthEntity<SouthFolderScannerSettings, SouthItemSettings>(
        'folder-scanner',
        { inputFolder: 'input', compression: false, username: 'admin', password: 'secret', domain: 'WORKGROUP' },
        []
      );
      south.id = 'folder-scanner-2';
      await createSouth(db, south);

      await up(db);

      const row = await db('south_connectors').where('id', 'folder-scanner-2').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.username, 'admin');
      assert.strictEqual(settings.password, 'secret');
      assert.strictEqual(settings.domain, 'WORKGROUP');
    });

    it('does not touch settings of south connectors of other types', async () => {
      const south = buildSouthEntity<SouthMSSQLSettings, SouthItemSettings>(
        'mssql',
        {
          host: 'host',
          port: 1433,
          connectionTimeout: 1000,
          database: 'database',
          username: 'oibus',
          password: 'pass',
          domain: 'domain',
          encryption: true,
          trustServerCertificate: true,
          requestTimeout: 5000
        },
        []
      );
      south.id = 'mssql-1';
      await createSouth(db, south);
      await db('south_connectors')
        .where('id', south.id)
        .update({ settings: JSON.stringify({ host: 'host', port: 1433 }) });

      await up(db);

      const row = await db('south_connectors').where('id', 'mssql-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.username, undefined, 'non folder-scanner settings are left untouched');
    });

    it('backfills username/password/domain as null for a file-writer north connector missing them', async () => {
      await insertScanMode(db, testData.scanMode.list[0].id);
      const north = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
        outputFolder: 'output',
        prefix: null,
        suffix: null,
        username: null,
        password: null,
        domain: null
      });
      north.id = 'file-writer-1';
      await createNorth(db, north);
      await db('north_connectors')
        .where('id', north.id)
        .update({ settings: JSON.stringify({ outputFolder: 'output', prefix: null, suffix: null }) });

      await up(db);

      const row = await db('north_connectors').where('id', 'file-writer-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.outputFolder, 'output', 'existing settings are preserved');
      assert.strictEqual(settings.username, null);
      assert.strictEqual(settings.password, null);
      assert.strictEqual(settings.domain, null);
    });

    it('preserves existing username/password/domain for a file-writer north connector that already has them', async () => {
      await insertScanMode(db, testData.scanMode.list[0].id);
      const north = buildNorthEntity<NorthFileWriterSettings>('file-writer', {
        outputFolder: 'output',
        prefix: null,
        suffix: null,
        username: 'admin',
        password: 'secret',
        domain: 'WORKGROUP'
      });
      north.id = 'file-writer-2';
      await createNorth(db, north);

      await up(db);

      const row = await db('north_connectors').where('id', 'file-writer-2').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.username, 'admin');
      assert.strictEqual(settings.password, 'secret');
      assert.strictEqual(settings.domain, 'WORKGROUP');
    });

    it('backfills south_settings for a history query with a folder-scanner south', async () => {
      await insertScanMode(db, testData.historyQueries.list[0].caching.trigger.scanMode.id);
      const historyQuery = {
        ...testData.historyQueries.list[0],
        id: 'history-folder-scanner',
        southType: 'folder-scanner',
        southSettings: { inputFolder: 'input', compression: false, username: null, password: null, domain: null } as SouthSettings,
        items: [],
        northTransformers: []
      };
      await createHistoryQuery(db, historyQuery);
      await db('history_queries')
        .where('id', historyQuery.id)
        .update({ south_settings: JSON.stringify({ inputFolder: 'input', compression: false }) });

      await up(db);

      const row = await db('history_queries').where('id', 'history-folder-scanner').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.inputFolder, 'input', 'existing settings are preserved');
      assert.strictEqual(settings.username, null);
      assert.strictEqual(settings.password, null);
      assert.strictEqual(settings.domain, null);
    });

    it('backfills north_settings for a history query with a file-writer north', async () => {
      await insertScanMode(db, testData.historyQueries.list[0].caching.trigger.scanMode.id);
      const historyQuery = {
        ...testData.historyQueries.list[0],
        id: 'history-file-writer',
        northType: 'file-writer',
        northSettings: {
          outputFolder: 'output',
          prefix: null,
          suffix: null,
          username: null,
          password: null,
          domain: null
        } as NorthSettings,
        items: [],
        northTransformers: []
      };
      await createHistoryQuery(db, historyQuery);
      await db('history_queries')
        .where('id', historyQuery.id)
        .update({ north_settings: JSON.stringify({ outputFolder: 'output', prefix: null, suffix: null }) });

      await up(db);

      const row = await db('history_queries').where('id', 'history-file-writer').first();
      const settings = JSON.parse(row.north_settings);
      assert.strictEqual(settings.outputFolder, 'output', 'existing settings are preserved');
      assert.strictEqual(settings.username, null);
      assert.strictEqual(settings.password, null);
      assert.strictEqual(settings.domain, null);
    });
  });

  describe('dropping the overlap column when it is still referenced by other tables', () => {
    it('does not fail with a FOREIGN KEY constraint error when group_items rows still reference south_item_groups/south_items, inside a real transaction', async () => {
      // Reproduces the production migration runner, which always wraps each migration file's up() in a
      // knex.transaction(...). Inside that transaction, knex's schema builder cannot toggle
      // `PRAGMA foreign_keys` around a dropColumn()-driven table rebuild, so DROP TABLE south_items/
      // south_item_groups would fail while group_items still holds rows referencing them.
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'mssql');
      await db('south_item_groups').insert({
        id: 'group-1',
        name: 'Group 1',
        south_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        overlap: 100,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('south_items').insert({
        id: 'item-1',
        name: 'Item 1',
        enabled: 1,
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        settings: '{}',
        sync_with_group: 1,
        overlap: 50,
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
      await db('group_items').insert({ group_id: 'group-1', item_id: 'item-1' });

      await db.transaction(async trx => {
        await up(trx);
      });

      const groupItemsRows = await db('group_items').select('*');
      assert.deepStrictEqual(groupItemsRows, [{ group_id: 'group-1', item_id: 'item-1' }], 'group_items row is preserved');
      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.start_time_offset, -50, 'item start_time_offset derived from old overlap');
      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.start_time_offset, -100, 'group start_time_offset derived from old overlap');
    });
  });
});
