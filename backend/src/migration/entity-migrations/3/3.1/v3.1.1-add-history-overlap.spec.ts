import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.1.1-add-history-overlap';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertSouthConnector(db: Knex, id: string, name: string) {
  await db('south_connectors').insert({
    id,
    name,
    type: 'mssql',
    enabled: true,
    settings: '{}',
    history_max_instant_per_item: 1,
    history_max_read_interval: 3600,
    history_read_delay: 200
  });
}

describe('Entity migration v3.1.1-add-history-overlap', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.1.1-add-history-overlap.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.1.1 schema', async () => {
    await up(db); // must not throw
  });

  it('adds a history_read_overlap column to south_connectors', async () => {
    await up(db);
    const cols = await columnNames(db, 'south_connectors');
    assert.ok(cols.includes('history_read_overlap'));
  });

  it('defaults history_read_overlap to 0 for existing rows', async () => {
    await insertSouthConnector(db, 'south-1', 'South A');

    await up(db);

    const row = await db('south_connectors').where('id', 'south-1').first();
    assert.strictEqual(row.history_read_overlap, 0);
  });

  it('defaults history_read_overlap to 0 for newly inserted rows post-migration', async () => {
    await up(db);
    await insertSouthConnector(db, 'south-2', 'South B');

    const row = await db('south_connectors').where('id', 'south-2').first();
    assert.strictEqual(row.history_read_overlap, 0);
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    const cols = await columnNames(db, 'south_connectors');
    assert.ok(cols.includes('history_read_overlap'), 'down does not revert the migration');
  });
});
