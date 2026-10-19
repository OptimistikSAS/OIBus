import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_3';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

const HTTPS_COLUMNS = [
  'https_enabled',
  'https_certificate_source',
  'https_certificate_id',
  'https_certificate_path',
  'https_private_key_path'
];

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.10.0_3', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_3.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
      auth_token_duration: '7d',
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
      oibus_version: '3.9.0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });
  afterEach(() => harness.afterEach());

  it('should add the https columns to engines, keeping existing installs on HTTP', async () => {
    await up(db);

    const cols = await columnNames(db, 'engines');
    for (const column of HTTPS_COLUMNS) {
      assert.ok(cols.includes(column), `engines.${column} added`);
    }
    const row = await db('engines').where('id', 'test-engine-id').first();
    assert.strictEqual(row.https_enabled, 0);
    assert.strictEqual(row.https_certificate_source, 'store');
    assert.strictEqual(row.https_certificate_id, null);
    assert.strictEqual(row.https_certificate_path, null);
    assert.strictEqual(row.https_private_key_path, null);
  });

  it('should drop the https columns on down', async () => {
    await up(db);
    await down(db);

    const cols = await columnNames(db, 'engines');
    for (const column of HTTPS_COLUMNS) {
      assert.ok(!cols.includes(column), `engines.${column} removed`);
    }
  });
});
