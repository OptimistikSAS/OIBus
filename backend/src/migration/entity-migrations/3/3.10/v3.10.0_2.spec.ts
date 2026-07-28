import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_2';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.10.0_2', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_2.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();

    await db('certificates').insert({
      id: 'test-certificate-id',
      name: 'Test Certificate',
      public_key: 'public key',
      private_key: 'private key',
      certificate: 'certificate',
      expiry: '2026-01-01T00:00:00Z'
    });
  });
  afterEach(() => harness.afterEach());

  async function columnNames(table: string): Promise<Array<string>> {
    const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
    return cols.map(c => c.name);
  }

  describe('up', () => {
    it('adds the certificate_chain column to certificates', async () => {
      await up(db);
      const cols = await columnNames('certificates');
      assert.ok(cols.includes('certificate_chain'), 'certificates.certificate_chain added');
    });

    it('leaves certificate_chain null for existing rows', async () => {
      await up(db);
      const row = await db('certificates').where('id', 'test-certificate-id').first();
      assert.strictEqual(row.certificate_chain, null);
    });
  });

  describe('down', () => {
    it('drops the certificate_chain column', async () => {
      await up(db);
      await down(db);
      const cols = await columnNames('certificates');
      assert.ok(!cols.includes('certificate_chain'), 'certificates.certificate_chain removed');
    });
  });

  it('is reversible: up → down → up produces the column again', async () => {
    await up(db);
    await down(db);
    await up(db);

    const cols = await columnNames('certificates');
    assert.ok(cols.includes('certificate_chain'), 'certificates.certificate_chain added');
  });
});
