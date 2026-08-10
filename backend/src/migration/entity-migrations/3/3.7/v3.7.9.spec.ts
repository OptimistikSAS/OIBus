import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.7.9';

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

describe('Entity migration v3.7.9', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.7.9.ts', db)
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

  it('adds an api_gateway_base_endpoint column to registrations', async () => {
    await up(db);

    const cols = await columnNames(db, 'registrations');
    assert.ok(cols.includes('api_gateway_base_endpoint'), 'registrations.api_gateway_base_endpoint added');
  });

  it("sets api_gateway_base_endpoint to '' for existing registration rows", async () => {
    await insertRow(db, 'registrations', { id: 'reg-1', host: 'my-host' });

    await up(db);

    const row = await db('registrations').where('id', 'reg-1').first();
    assert.strictEqual(row.api_gateway_base_endpoint, '');
  });

  it('preserves other registration column values', async () => {
    await insertRow(db, 'registrations', { id: 'reg-2', host: 'other-host' });

    await up(db);

    const row = await db('registrations').where('id', 'reg-2').first();
    assert.strictEqual(row.host, 'other-host');
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw
  });
});
