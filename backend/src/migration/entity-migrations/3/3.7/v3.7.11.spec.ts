import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.7.11';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

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

async function insertScanMode(db: Knex, id: string, description: string | null) {
  return insertRow(db, 'scan_modes', {
    id,
    name: `Scan mode ${id}`,
    cron: '*/10 * * * * *',
    description
  });
}

describe('Entity migration v3.7.11', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.7.11.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end with no existing rows', async () => {
    await up(db); // must not throw
  });

  describe('south_connectors', () => {
    it("replaces a null description with '' ", async () => {
      await insertRow(db, 'south_connectors', {
        id: 'south-null',
        name: 'South Null',
        type: 'opcua',
        enabled: 1,
        settings: '{}',
        description: null
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-null').first();
      assert.strictEqual(row.description, '');
    });

    it('leaves a non-null description untouched', async () => {
      await insertRow(db, 'south_connectors', {
        id: 'south-desc',
        name: 'South Desc',
        type: 'opcua',
        enabled: 1,
        settings: '{}',
        description: 'a real description'
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-desc').first();
      assert.strictEqual(row.description, 'a real description');
    });
  });

  describe('north_connectors', () => {
    it("replaces a null description with '' ", async () => {
      await insertScanMode(db, 'scan-mode-north-1', null);
      await insertRow(db, 'north_connectors', {
        id: 'north-null',
        name: 'North Null',
        type: 'file-writer',
        enabled: 1,
        settings: '{}',
        caching_trigger_schedule: 'scan-mode-north-1',
        description: null
      });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-null').first();
      assert.strictEqual(row.description, '');
    });

    it('leaves a non-null description untouched', async () => {
      await insertScanMode(db, 'scan-mode-north-2', null);
      await insertRow(db, 'north_connectors', {
        id: 'north-desc',
        name: 'North Desc',
        type: 'file-writer',
        enabled: 1,
        settings: '{}',
        caching_trigger_schedule: 'scan-mode-north-2',
        description: 'a real description'
      });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-desc').first();
      assert.strictEqual(row.description, 'a real description');
    });
  });

  describe('history_queries', () => {
    it("replaces a null description with '' ", async () => {
      await insertScanMode(db, 'scan-mode-history-1', null);
      await insertRow(db, 'history_queries', {
        id: 'history-null',
        name: 'History Null',
        south_type: 'opcua',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        start_time: '2026-01-01 00:00:00',
        end_time: '2026-01-02 00:00:00',
        caching_trigger_schedule: 'scan-mode-history-1',
        description: null
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-null').first();
      assert.strictEqual(row.description, '');
    });

    it('leaves a non-null description untouched', async () => {
      await insertScanMode(db, 'scan-mode-history-2', null);
      await insertRow(db, 'history_queries', {
        id: 'history-desc',
        name: 'History Desc',
        south_type: 'opcua',
        north_type: 'file-writer',
        south_settings: '{}',
        north_settings: '{}',
        start_time: '2026-01-01 00:00:00',
        end_time: '2026-01-02 00:00:00',
        caching_trigger_schedule: 'scan-mode-history-2',
        description: 'a real description'
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-desc').first();
      assert.strictEqual(row.description, 'a real description');
    });
  });

  describe('ip_filters', () => {
    it("replaces a null description with '' ", async () => {
      await insertRow(db, 'ip_filters', { id: 'ip-null', address: '10.0.0.1', description: null });

      await up(db);

      const row = await db('ip_filters').where('id', 'ip-null').first();
      assert.strictEqual(row.description, '');
    });

    it('leaves a non-null description untouched', async () => {
      await insertRow(db, 'ip_filters', { id: 'ip-desc', address: '10.0.0.2', description: 'a real description' });

      await up(db);

      const row = await db('ip_filters').where('id', 'ip-desc').first();
      assert.strictEqual(row.description, 'a real description');
    });
  });

  describe('scan_modes', () => {
    it("replaces a null description with '' ", async () => {
      await insertScanMode(db, 'scan-mode-null', null);

      await up(db);

      const row = await db('scan_modes').where('id', 'scan-mode-null').first();
      assert.strictEqual(row.description, '');
    });

    it('leaves a non-null description untouched', async () => {
      await insertScanMode(db, 'scan-mode-desc', 'a real description');

      await up(db);

      const row = await db('scan_modes').where('id', 'scan-mode-desc').first();
      assert.strictEqual(row.description, 'a real description');
    });
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw
  });
});
