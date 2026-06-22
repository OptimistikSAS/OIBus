import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up } from './v3.9.1';

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

async function buildPreV391Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.9.1');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.9.1', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v391-'));
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
    await buildPreV391Schema(db);
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
      oibus_version: '3.9.0',
      log_syslog_level: 'silent',
      log_syslog_host: '',
      log_syslog_port: 514,
      log_syslog_protocol: 'udp4',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  it('runs end-to-end on a realistic pre-3.9.1 schema', async () => {
    await up(db);
  });

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

  it('leaves recovery_strategy null for existing rows', async () => {
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
    await db('south_connectors').insert({
      id: 'south-1',
      name: 'Test SQL',
      type: 'mssql',
      description: '',
      enabled: 1,
      settings: '{}',
      created_by: 'admin',
      updated_by: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
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
    assert.strictEqual(group.recovery_strategy, null, 'existing group row has null recovery_strategy');

    const item = await db('south_items').where('id', 'item-1').first();
    assert.strictEqual(item.recovery_strategy, null, 'existing item row has null recovery_strategy');
  });
});
