import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.9.2';

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

async function buildPreV392Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.9.2');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertScanMode(db: Knex) {
  await db('scan_modes').insert({
    id: 'scan-mode-1',
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *',
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthConnector(db: Knex) {
  await db('south_connectors').insert({
    id: 'south-1',
    name: 'Test OPCUA',
    type: 'opcua',
    description: '',
    enabled: 1,
    settings: '{}',
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.9.2', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v392-'));
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
    await buildPreV392Schema(db);
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
      oibus_version: '3.9.1',
      log_syslog_level: 'silent',
      log_syslog_host: '',
      log_syslog_port: 514,
      log_syslog_protocol: 'udp4',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  it('runs up end-to-end on a realistic pre-3.9.2 schema', async () => {
    await up(db);
  });

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
    assert.strictEqual(group.end_time_offset, null, 'end_time_offset defaults to null');
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
    assert.strictEqual(item.end_time_offset, null, 'end_time_offset defaults to null');
  });

  it('up keeps start_time_offset null when overlap was null', async () => {
    await insertScanMode(db);
    await insertSouthConnector(db);
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
    assert.strictEqual(group.start_time_offset, null, 'null overlap → null start_time_offset for group');

    const item = await db('south_items').where('id', 'item-1').first();
    assert.strictEqual(item.start_time_offset, null, 'null overlap → null start_time_offset for item');
  });

  it('down restores overlap column and drops start_time_offset and end_time_offset', async () => {
    await up(db);
    await down(db);

    const groupCols = await columnNames(db, 'south_item_groups');
    assert.ok(groupCols.includes('overlap'), 'south_item_groups.overlap restored');
    assert.ok(!groupCols.includes('start_time_offset'), 'south_item_groups.start_time_offset removed');
    assert.ok(!groupCols.includes('end_time_offset'), 'south_item_groups.end_time_offset removed');

    const itemCols = await columnNames(db, 'south_items');
    assert.ok(itemCols.includes('overlap'), 'south_items.overlap restored');
    assert.ok(!itemCols.includes('start_time_offset'), 'south_items.start_time_offset removed');
    assert.ok(!itemCols.includes('end_time_offset'), 'south_items.end_time_offset removed');
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
