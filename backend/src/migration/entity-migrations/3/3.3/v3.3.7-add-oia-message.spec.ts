import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.3.7-add-oia-message';

const TARGET_BASENAME = 'v3.3.7-add-oia-message.ts';

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

/** Build the real schema as it exists just before this migration by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < TARGET_BASENAME);
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertEngine(db: Knex, id = 'engine-1') {
  await db('engines').insert({
    id,
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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({
    id,
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *'
  });
}

async function insertSouthConnector(db: Knex, id: string, type: string) {
  await db('south_connectors').insert({
    id,
    name: `Test ${type} ${id}`,
    type,
    description: '',
    enabled: 1,
    settings: '{}',
    history_max_instant_per_item: 0,
    history_max_read_interval: 3600,
    history_read_delay: 200,
    history_read_overlap: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthItem(db: Knex, id: string, connectorId: string, scanModeId: string, settings: unknown, name?: string) {
  await db('south_items').insert({
    id,
    connector_id: connectorId,
    scan_mode_id: scanModeId,
    name: name ?? `Item ${id}`,
    enabled: 1,
    settings: JSON.stringify(settings),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.3.7-add-oia-message', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v337-'));
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
    await buildPriorSchema(db);
    await insertEngine(db);
    await insertScanMode(db);
  });

  it('runs end-to-end on a realistic pre-3.3.7 schema', async () => {
    await up(db); // must not throw
  });

  it('creates the oianalytics_messages table with the expected columns', async () => {
    await up(db);
    const cols = await columnNames(db, 'oianalytics_messages');
    assert.ok(cols.includes('id'));
    assert.ok(cols.includes('type'));
    assert.ok(cols.includes('content'));
    assert.ok(cols.includes('completed_date'));
    assert.ok(cols.includes('error'));
    assert.ok(cols.includes('status'));
  });

  it('defaults oianalytics_messages status to PENDING', async () => {
    await up(db);
    await db('oianalytics_messages').insert({
      id: 'msg-1',
      type: 'info',
      content: JSON.stringify({}),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
    const row = await db('oianalytics_messages').where('id', 'msg-1').first();
    assert.strictEqual(row.status, 'PENDING');
  });

  it('adds oibus_version to engines and defaults existing rows to 3.8.0', async () => {
    await up(db);
    const cols = await columnNames(db, 'engines');
    assert.ok(cols.includes('oibus_version'));
    const engine = await db('engines').where('id', 'engine-1').first();
    assert.strictEqual(engine.oibus_version, '3.8.0');
  });

  it('rewrites modbus south item settings into the nested data shape, for every item of a modbus connector', async () => {
    await insertSouthConnector(db, 'modbus-1', 'modbus');
    await insertSouthItem(
      db,
      'item-1',
      'modbus-1',
      'scan-mode-1',
      { address: '0x01', modbusType: 'coil', dataType: 'Bit', multiplierCoefficient: 1, bitIndex: 0 },
      'Item A'
    );
    await insertSouthItem(
      db,
      'item-2',
      'modbus-1',
      'scan-mode-1',
      { address: '0x02', modbusType: 'holdingRegister', dataType: 'Float', multiplierCoefficient: 2, bitIndex: 1 },
      'Item B'
    );

    await up(db);

    const item1 = await db('south_items').where('id', 'item-1').first();
    const settings1 = JSON.parse(item1.settings);
    assert.strictEqual(settings1.address, '0x01');
    assert.strictEqual(settings1.modbusType, 'coil');
    assert.deepStrictEqual(settings1.data, { dataType: 'Bit', multiplierCoefficient: 1, bitIndex: 0 });
    assert.strictEqual(settings1.dataType, undefined, 'old flat dataType field is removed');

    const item2 = await db('south_items').where('id', 'item-2').first();
    const settings2 = JSON.parse(item2.settings);
    assert.deepStrictEqual(settings2.data, { dataType: 'Float', multiplierCoefficient: 2, bitIndex: 1 });
  });

  it('does not touch settings of items belonging to non-modbus connectors', async () => {
    await insertSouthConnector(db, 'folder-scanner-1', 'folder-scanner');
    const oldSettings = { inputFolder: 'input', compression: false };
    await insertSouthItem(db, 'item-3', 'folder-scanner-1', 'scan-mode-1', oldSettings);

    await up(db);

    const item = await db('south_items').where('id', 'item-3').first();
    const settings = JSON.parse(item.settings);
    assert.deepStrictEqual(settings, oldSettings, 'non modbus item settings are left untouched');
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    const cols = await columnNames(db, 'oianalytics_messages');
    assert.ok(cols.includes('id'), 'down does not revert the up() migration');
  });
});
