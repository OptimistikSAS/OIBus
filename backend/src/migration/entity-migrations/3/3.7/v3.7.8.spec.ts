import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.7.8';

const THIS_FILE = 'v3.7.8.ts';

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

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  return (await pragmaColumns(db, table)).map(c => c.name);
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

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Entity migration v3.7.8', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v378-'));
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

  it('runs end-to-end on an empty schema (no junction data to migrate)', async () => {
    await up(db); // must not throw; exercises the length === 0 branches of every junction-data restore loop
  });

  it('converts non-ISO timestamps to ISO 8601 with millisecond precision and Z suffix', async () => {
    await insertRow(db, 'engines', { id: 'engine-1', oibus_version: '3.7.0' });
    const before1 = await db('engines').where('id', 'engine-1').first();
    assert.ok(!ISO_DATETIME_REGEX.test(before1.created_at), 'sanity check: pre-migration timestamp is not already ISO 8601');

    await up(db);

    const after1 = await db('engines').where('id', 'engine-1').first();
    assert.match(after1.created_at, ISO_DATETIME_REGEX, 'created_at converted to ISO 8601');
    assert.match(after1.updated_at, ISO_DATETIME_REGEX, 'updated_at converted to ISO 8601');
  });

  it('preserves non-timestamp column values on recreated standalone tables', async () => {
    await insertRow(db, 'engines', { id: 'engine-2', oibus_version: '3.7.5', name: 'MyEngine', port: 1234 });
    await insertRow(db, 'registrations', { id: 'reg-1', host: 'my-host' });

    await up(db);

    const engine = await db('engines').where('id', 'engine-2').first();
    assert.strictEqual(engine.name, 'MyEngine');
    assert.strictEqual(engine.port, 1234);
    assert.strictEqual(engine.oibus_version, '3.7.5');

    const registration = await db('registrations').where('id', 'reg-1').first();
    assert.strictEqual(registration.host, 'my-host');
  });

  it('adds api_gateway columns to registrations with default values', async () => {
    await insertRow(db, 'registrations', { id: 'reg-2', host: 'another-host' });

    await up(db);

    const cols = await columnNames(db, 'registrations');
    assert.ok(cols.includes('use_api_gateway'), 'use_api_gateway column added');
    assert.ok(cols.includes('api_gateway_header_key'), 'api_gateway_header_key column added');
    assert.ok(cols.includes('api_gateway_header_value'), 'api_gateway_header_value column added');

    const registration = await db('registrations').where('id', 'reg-2').first();
    assert.strictEqual(registration.use_api_gateway, 0);
    assert.strictEqual(registration.api_gateway_header_key, '');
    assert.strictEqual(registration.api_gateway_header_value, '');
  });

  describe('junction/dependent table data preservation', () => {
    beforeEach(async () => {
      await insertRow(db, 'scan_modes', { id: 'scan-mode-1', name: 'Scan mode 1', cron: '*/10 * * * * *' });
      await insertRow(db, 'south_connectors', { id: 'south-1', name: 'South 1', type: 'opcua', enabled: 1, settings: '{}' });
      await insertRow(db, 'north_connectors', {
        id: 'north-1',
        name: 'North 1',
        type: 'file-writer',
        enabled: 1,
        settings: '{}',
        caching_trigger_schedule: 'scan-mode-1'
      });
      await insertRow(db, 'history_queries', {
        id: 'history-1',
        name: 'History 1',
        south_type: 'opcua',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        start_time: '2026-01-01 00:00:00',
        end_time: '2026-01-02 00:00:00',
        caching_trigger_schedule: 'scan-mode-1'
      });
      await insertRow(db, 'south_items', {
        id: 'south-item-1',
        connector_id: 'south-1',
        scan_mode_id: 'scan-mode-1',
        name: 'South Item 1',
        enabled: 1,
        settings: JSON.stringify({ nodeId: 'ns=1;s=item1' })
      });
      await insertRow(db, 'history_items', {
        id: 'history-item-1',
        history_id: 'history-1',
        name: 'History Item 1',
        enabled: 1,
        settings: JSON.stringify({ nodeId: 'ns=1;s=hitem1' })
      });
      await insertRow(db, 'subscription', { north_connector_id: 'north-1', south_connector_id: 'south-1' });
      await insertRow(db, 'transformers', { id: 'transformer-1', type: 'standard', input_type: 'json', output_type: 'json' });
      await insertRow(db, 'north_transformers', {
        north_id: 'north-1',
        transformer_id: 'transformer-1',
        options: 'opts',
        input_type: 'json'
      });
      await insertRow(db, 'history_query_transformers', {
        history_id: 'history-1',
        transformer_id: 'transformer-1',
        options: 'opts',
        input_type: 'json'
      });
    });

    it('preserves south_items rows across the drop/recreate', async () => {
      await up(db);

      const row = await db('south_items').where('id', 'south-item-1').first();
      assert.strictEqual(row.connector_id, 'south-1');
      assert.strictEqual(row.scan_mode_id, 'scan-mode-1');
      assert.strictEqual(row.name, 'South Item 1');
      assert.strictEqual(JSON.parse(row.settings).nodeId, 'ns=1;s=item1');
    });

    it('preserves history_items rows across the drop/recreate', async () => {
      await up(db);

      const row = await db('history_items').where('id', 'history-item-1').first();
      assert.strictEqual(row.history_id, 'history-1');
      assert.strictEqual(row.name, 'History Item 1');
      assert.strictEqual(JSON.parse(row.settings).nodeId, 'ns=1;s=hitem1');
    });

    it('preserves subscription rows across the drop/recreate', async () => {
      await up(db);

      const row = await db('subscription').where({ north_connector_id: 'north-1', south_connector_id: 'south-1' }).first();
      assert.ok(row, 'subscription row restored');
    });

    it('preserves north_transformers rows across the drop/recreate', async () => {
      await up(db);

      const row = await db('north_transformers').where({ north_id: 'north-1', transformer_id: 'transformer-1' }).first();
      assert.ok(row, 'north_transformers row restored');
      assert.strictEqual(row.options, 'opts');
      assert.strictEqual(row.input_type, 'json');
    });

    it('preserves history_query_transformers rows across the drop/recreate', async () => {
      await up(db);

      const row = await db('history_query_transformers').where({ history_id: 'history-1', transformer_id: 'transformer-1' }).first();
      assert.ok(row, 'history_query_transformers row restored');
      assert.strictEqual(row.options, 'opts');
      assert.strictEqual(row.input_type, 'json');
    });

    it('south_connectors, north_connectors and history_queries survive the recreate with data intact', async () => {
      await up(db);

      const south = await db('south_connectors').where('id', 'south-1').first();
      assert.strictEqual(south.name, 'South 1');
      assert.strictEqual(south.type, 'opcua');

      const north = await db('north_connectors').where('id', 'north-1').first();
      assert.strictEqual(north.name, 'North 1');
      assert.strictEqual(north.caching_trigger_schedule, 'scan-mode-1');

      const history = await db('history_queries').where('id', 'history-1').first();
      assert.strictEqual(history.name, 'History 1');
      assert.strictEqual(history.caching_trigger_schedule, 'scan-mode-1');
    });
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw
  });
});
