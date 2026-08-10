import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.1.1-add-certificates-table';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.1.1-add-certificates-table', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.1.1-add-certificates-table.ts', db)
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

  it('creates the certificates table with the expected columns', async () => {
    await up(db);
    assert.ok(await db.schema.hasTable('certificates'));
    const cols = await columnNames(db, 'certificates');
    assert.deepStrictEqual(
      cols.sort(),
      ['id', 'created_at', 'updated_at', 'name', 'description', 'public_key', 'private_key', 'expiry', 'certificate'].sort()
    );
  });

  it('allows inserting a certificate row with required fields', async () => {
    await up(db);
    await db('certificates').insert({
      id: 'cert-1',
      name: 'Cert A',
      public_key: 'pub',
      private_key: 'priv',
      certificate: 'cert-content'
    });

    const row = await db('certificates').where('id', 'cert-1').first();
    assert.strictEqual(row.name, 'Cert A');
    assert.strictEqual(row.description, null);
    assert.strictEqual(row.expiry, null);
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    assert.ok(await db.schema.hasTable('certificates'), 'down does not revert the migration');
  });
});
