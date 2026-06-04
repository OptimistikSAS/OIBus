import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up } from './v3.8.0';

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

/** Build the real schema as it exists just before v3.8.0 by running every prior migration in order. */
async function buildPreV380Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.8.0');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function tableExists(db: Knex, table: string): Promise<boolean> {
  const row = await db.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
  return (row as Array<unknown>).length > 0;
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

const STANDARD_TRANSFORMER_FUNCTIONS = [
  'csv-to-mqtt',
  'csv-to-time-values',
  'ignore',
  'iso',
  'json-to-csv',
  'time-values-to-csv',
  'time-values-to-json',
  'time-values-to-modbus',
  'time-values-to-mqtt',
  'time-values-to-oianalytics',
  'time-values-to-opcua',
  'setpoint-to-modbus',
  'setpoint-to-mqtt',
  'setpoint-to-opcua'
];

describe('Entity migration v3.8.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    // File-based SQLite is required: several steps recreate tables (dropColumns / drop+create),
    // which need a real file connection.
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v380-'));
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
    await buildPreV380Schema(db);
  });

  describe('schema and default transformers', () => {
    it('runs end-to-end on a realistic pre-3.8.0 schema', async () => {
      await up(db); // must not throw
    });

    it('seeds all standard transformers', async () => {
      await up(db);
      const rows = await db('transformers').where('type', 'standard').select('function_name');
      const names = new Set(rows.map(r => r.function_name));
      for (const fn of STANDARD_TRANSFORMER_FUNCTIONS) {
        assert.ok(names.has(fn), `standard transformer "${fn}" should be seeded`);
      }
    });

    it('applies the expected schema changes', async () => {
      await up(db);

      // makeSouthItemScanModeIdNullable
      const southItemCols = (await db.raw('PRAGMA table_info(south_items)')) as Array<{ name: string; notnull: number }>;
      const scanModeCol = southItemCols.find(c => c.name === 'scan_mode_id');
      assert.ok(scanModeCol && scanModeCol.notnull === 0, 'south_items.scan_mode_id should be nullable');

      // addCreatedByAndUpdatedBy
      assert.ok((await columnNames(db, 'south_connectors')).includes('created_by'), 'south_connectors.created_by added');
      assert.ok((await columnNames(db, 'south_connectors')).includes('updated_by'), 'south_connectors.updated_by added');

      // createSouthItemGroupsTable / addTransformersItems
      assert.ok(await tableExists(db, 'south_item_groups'), 'south_item_groups table created');
      assert.ok(await tableExists(db, 'north_transformers_items'), 'north_transformers_items table created');

      // migrateSubscriptionsToTransformers: subscription table dropped, north_transformers reshaped
      assert.ok(!(await tableExists(db, 'subscription')), 'old subscription table dropped');
      const northTransformerCols = await columnNames(db, 'north_transformers');
      assert.ok(northTransformerCols.includes('source_south_south_id'), 'north_transformers gains source_south_south_id');
      assert.ok(!northTransformerCols.includes('input_type'), 'north_transformers no longer has input_type');
    });
  });

  describe('seeded MQTT custom transformer', () => {
    beforeEach(async () => {
      // The custom "mqtt-transformer" is only created when at least one MQTT South exists.
      await db('south_connectors').insert({ id: 'mqttSo', name: 'MQTT', type: 'mqtt', enabled: 0, settings: '{}' });
    });

    it('creates the mqtt custom transformer with the correct argument order (regression guard)', async () => {
      await up(db);

      const transformer = await db('transformers').where({ type: 'custom', name: 'mqtt-transformer' }).first();
      assert.ok(transformer, 'a custom mqtt-transformer should be created');
      assert.strictEqual(transformer.input_type, 'any-content');
      assert.strictEqual(transformer.output_type, 'time-values');

      const code: string = transformer.custom_code;
      // The sandbox calls transforms as (content, source, filename, options). The seeded code MUST
      // match that order, otherwise `filename` receives the options object and a JSON value ends up
      // in lastContentSent / the metrics database (the bug this guards against).
      assert.ok(
        code.includes('content: string, source: any, filename: string, options: any'),
        'transform must use the (content, source, filename, options) signature'
      );
      assert.ok(
        !code.includes('content: string, options: any, source: any, filename: string'),
        'transform must NOT use the buggy (content, options, source, filename) signature'
      );
      // The engine reads `numberOfElement` (singular), not `numberOfElements`.
      assert.ok(!code.includes('numberOfElements'), 'return field must be numberOfElement, not numberOfElements');
    });
  });
});
