import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.7.2';

const THIS_FILE = 'v3.7.2.ts';

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

/** Build the real schema as it exists just before this migration by running every lexicographically-earlier migration. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < THIS_FILE);
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

interface PragmaColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

async function pragmaColumns(db: Knex, table: string): Promise<Array<PragmaColumn>> {
  return (await db.raw(`PRAGMA table_info(${table})`)) as Array<PragmaColumn>;
}

/**
 * Insert a row into `table`, auto-filling any NOT NULL column without a default that isn't
 * present in `overrides`. This keeps inserts valid across schema snapshots without hand-listing
 * every column of every historical schema.
 */
async function insertRow(db: Knex, table: string, overrides: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cols = await pragmaColumns(db, table);
  const row: Record<string, unknown> = { ...overrides };
  for (const col of cols) {
    if (col.name in row) {
      continue;
    }
    if (col.notnull === 1 && col.dflt_value === null) {
      const t = col.type.toLowerCase();
      if (t.includes('json')) {
        row[col.name] = '{}';
      } else if (t.includes('int') || t.includes('bool')) {
        row[col.name] = 0;
      } else {
        row[col.name] = '';
      }
    }
  }
  await db(table).insert(row);
  return row;
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  return insertRow(db, 'scan_modes', {
    id,
    name: `Scan mode ${id}`,
    cron: '*/10 * * * * *'
  });
}

describe('Entity migration v3.7.2', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v372-'));
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
  });

  it('runs end-to-end with no matching rows', async () => {
    await up(db); // must not throw
  });

  describe('south_connectors throttling.maxInstantPerItem boolean coercion', () => {
    it("coerces a truthy non-boolean maxInstantPerItem to true for type 'opcua'", async () => {
      await insertRow(db, 'south_connectors', {
        id: 'south-opcua-1',
        name: 'South OPCUA',
        type: 'opcua',
        enabled: 1,
        settings: JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: 1 } })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-opcua-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.throttling.maxInstantPerItem, true);
      assert.strictEqual(settings.throttling.maxReadInterval, 1000, 'other throttling fields preserved');
    });

    it("coerces a falsy maxInstantPerItem to false for type 'opc'", async () => {
      await insertRow(db, 'south_connectors', {
        id: 'south-opc-1',
        name: 'South OPC',
        type: 'opc',
        enabled: 1,
        settings: JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: 0 } })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-opc-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.throttling.maxInstantPerItem, false);
    });

    it('does not touch settings of south connectors of other types', async () => {
      const originalSettings = JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: 1 } });
      await insertRow(db, 'south_connectors', {
        id: 'south-mqtt-1',
        name: 'South MQTT',
        type: 'mqtt',
        enabled: 1,
        settings: originalSettings
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-mqtt-1').first();
      assert.strictEqual(row.settings, originalSettings, 'settings left untouched for non-matching type');
    });
  });

  describe('history_queries south_settings throttling.maxInstantPerItem boolean coercion', () => {
    it("coerces a truthy non-boolean maxInstantPerItem to true for south_type 'osisoft-pi'", async () => {
      await insertScanMode(db);
      await insertRow(db, 'history_queries', {
        id: 'history-osisoft-1',
        name: 'History OSIsoft',
        south_type: 'osisoft-pi',
        north_type: 'file-writer',
        south_settings: JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: 'yes' } }),
        north_settings: JSON.stringify({}),
        caching_trigger_schedule: 'scan-mode-1'
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-osisoft-1').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.throttling.maxInstantPerItem, true);
    });

    it('does not touch south_settings of history queries with a non-matching south_type', async () => {
      await insertScanMode(db);
      const originalSettings = JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: 1 } });
      await insertRow(db, 'history_queries', {
        id: 'history-modbus-1',
        name: 'History Modbus',
        south_type: 'modbus',
        north_type: 'file-writer',
        south_settings: originalSettings,
        north_settings: JSON.stringify({}),
        caching_trigger_schedule: 'scan-mode-1'
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-modbus-1').first();
      assert.strictEqual(row.south_settings, originalSettings, 'south_settings left untouched for non-matching south_type');
    });
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw
  });
});
