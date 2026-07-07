import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.7.4';

const THIS_FILE = 'v3.7.4.ts';

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

describe('Entity migration v3.7.4', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v374-'));
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

  describe('south_items opcua ha/da settings split', () => {
    it("keeps haMode and drops timestampOrigin for a 'ha' mode item", async () => {
      await insertScanMode(db);
      await insertRow(db, 'south_connectors', {
        id: 'south-opcua-1',
        name: 'South OPCUA',
        type: 'opcua',
        enabled: 1,
        settings: '{}'
      });
      await insertRow(db, 'south_items', {
        id: 'item-ha-1',
        connector_id: 'south-opcua-1',
        scan_mode_id: 'scan-mode-1',
        name: 'Item HA',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=ha',
          mode: 'ha',
          haMode: { aggregate: 'average', resampling: '1s' },
          timestampOrigin: 'server'
        })
      });

      await up(db);

      const item = await db('south_items').where('id', 'item-ha-1').first();
      const settings = JSON.parse(item.settings);
      assert.deepStrictEqual(settings.haMode, { aggregate: 'average', resampling: '1s' }, 'haMode retained for ha mode');
      assert.strictEqual(settings.timestampOrigin, undefined, 'timestampOrigin dropped for ha mode');
    });

    it("keeps timestampOrigin and drops haMode for a 'da' mode item", async () => {
      await insertScanMode(db);
      await insertRow(db, 'south_connectors', {
        id: 'south-opcua-2',
        name: 'South OPCUA 2',
        type: 'opcua',
        enabled: 1,
        settings: '{}'
      });
      await insertRow(db, 'south_items', {
        id: 'item-da-1',
        connector_id: 'south-opcua-2',
        scan_mode_id: 'scan-mode-1',
        name: 'Item DA',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=da',
          mode: 'da',
          haMode: { aggregate: 'raw' },
          timestampOrigin: 'point'
        })
      });

      await up(db);

      const item = await db('south_items').where('id', 'item-da-1').first();
      const settings = JSON.parse(item.settings);
      assert.strictEqual(settings.haMode, undefined, 'haMode dropped for da mode');
      assert.strictEqual(settings.timestampOrigin, 'point', 'timestampOrigin retained for da mode');
    });

    it('updates every matching south_item when a connector has several opcua items', async () => {
      await insertScanMode(db);
      await insertRow(db, 'south_connectors', {
        id: 'south-opcua-3',
        name: 'South OPCUA 3',
        type: 'opcua',
        enabled: 1,
        settings: '{}'
      });
      await insertRow(db, 'south_items', {
        id: 'item-ha-2',
        connector_id: 'south-opcua-3',
        scan_mode_id: 'scan-mode-1',
        name: 'Item HA 2',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=ha-2',
          mode: 'ha',
          haMode: { aggregate: 'count' },
          timestampOrigin: 'server'
        })
      });
      await insertRow(db, 'south_items', {
        id: 'item-da-2',
        connector_id: 'south-opcua-3',
        scan_mode_id: 'scan-mode-1',
        name: 'Item DA 2',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=da-2',
          mode: 'da',
          haMode: { aggregate: 'raw' },
          timestampOrigin: 'oibus'
        })
      });

      await up(db);

      const haItem = await db('south_items').where('id', 'item-ha-2').first();
      const haSettings = JSON.parse(haItem.settings);
      assert.deepStrictEqual(haSettings.haMode, { aggregate: 'count' }, 'haMode retained for ha mode item');
      assert.strictEqual(haSettings.timestampOrigin, undefined, 'timestampOrigin dropped for ha mode item');

      const daItem = await db('south_items').where('id', 'item-da-2').first();
      const daSettings = JSON.parse(daItem.settings);
      assert.strictEqual(daSettings.haMode, undefined, 'haMode dropped for da mode item');
      assert.strictEqual(daSettings.timestampOrigin, 'oibus', 'timestampOrigin retained for da mode item');
    });

    it('does not touch south_items of a south connector of another type', async () => {
      await insertScanMode(db);
      await insertRow(db, 'south_connectors', {
        id: 'south-mqtt-1',
        name: 'South MQTT',
        type: 'mqtt',
        enabled: 1,
        settings: '{}'
      });
      const originalSettings = JSON.stringify({ nodeId: 'irrelevant', mode: 'ha', haMode: { aggregate: 'raw' } });
      await insertRow(db, 'south_items', {
        id: 'item-mqtt-1',
        connector_id: 'south-mqtt-1',
        scan_mode_id: 'scan-mode-1',
        name: 'Item MQTT',
        enabled: 1,
        settings: originalSettings
      });

      await up(db);

      const item = await db('south_items').where('id', 'item-mqtt-1').first();
      assert.strictEqual(item.settings, originalSettings, 'settings left untouched for non-opcua south connector');
    });
  });

  describe('history_items opcua ha/da settings split', () => {
    it("keeps haMode and drops timestampOrigin for a 'ha' mode history item", async () => {
      await insertScanMode(db);
      await insertRow(db, 'history_queries', {
        id: 'history-opcua-1',
        name: 'History OPCUA',
        south_type: 'opcua',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        caching_trigger_schedule: 'scan-mode-1'
      });
      await insertRow(db, 'history_items', {
        id: 'history-item-ha-1',
        history_id: 'history-opcua-1',
        name: 'History Item HA',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=ha',
          mode: 'ha',
          haMode: { aggregate: 'minimum' },
          timestampOrigin: 'server'
        })
      });

      await up(db);

      const item = await db('history_items').where('id', 'history-item-ha-1').first();
      const settings = JSON.parse(item.settings);
      assert.deepStrictEqual(settings.haMode, { aggregate: 'minimum' }, 'haMode retained for ha mode');
      assert.strictEqual(settings.timestampOrigin, undefined, 'timestampOrigin dropped for ha mode');
    });

    it("keeps timestampOrigin and drops haMode for a 'da' mode history item", async () => {
      await insertScanMode(db);
      await insertRow(db, 'history_queries', {
        id: 'history-opcua-2',
        name: 'History OPCUA 2',
        south_type: 'opcua',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        caching_trigger_schedule: 'scan-mode-1'
      });
      await insertRow(db, 'history_items', {
        id: 'history-item-da-1',
        history_id: 'history-opcua-2',
        name: 'History Item DA',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=da',
          mode: 'da',
          haMode: { aggregate: 'raw' },
          timestampOrigin: 'oibus'
        })
      });

      await up(db);

      const item = await db('history_items').where('id', 'history-item-da-1').first();
      const settings = JSON.parse(item.settings);
      assert.strictEqual(settings.haMode, undefined, 'haMode dropped for da mode');
      assert.strictEqual(settings.timestampOrigin, 'oibus', 'timestampOrigin retained for da mode');
    });

    it('does not touch history_items of a history query with a non-opcua south_type', async () => {
      await insertScanMode(db);
      const originalSettings = JSON.stringify({ nodeId: 'irrelevant', mode: 'ha', haMode: { aggregate: 'raw' } });
      await insertRow(db, 'history_queries', {
        id: 'history-modbus-1',
        name: 'History Modbus',
        south_type: 'modbus',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        caching_trigger_schedule: 'scan-mode-1'
      });
      await insertRow(db, 'history_items', {
        id: 'history-item-modbus-1',
        history_id: 'history-modbus-1',
        name: 'History Item Modbus',
        enabled: 1,
        settings: originalSettings
      });

      await up(db);

      const item = await db('history_items').where('id', 'history-item-modbus-1').first();
      assert.strictEqual(item.settings, originalSettings, 'settings left untouched for non-opcua history query');
    });
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw
  });
});
