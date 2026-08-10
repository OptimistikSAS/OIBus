import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.3.1-oia-registration';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertRegistration(
  db: Knex,
  overrides: Partial<{
    id: string;
    host: string;
    activation_code: string | null;
    check_url: string | null;
    token: string | null;
    status: string;
  }> = {}
) {
  await db('registrations').insert({
    id: overrides.id ?? 'registration-1',
    host: overrides.host ?? 'https://oia.example.com',
    use_proxy: 0,
    proxy_url: null,
    proxy_username: null,
    proxy_password: null,
    accept_unauthorized: '0',
    activation_code: overrides.activation_code ?? 'ABC123',
    check_url: overrides.check_url ?? 'https://oia.example.com/check',
    activation_date: null,
    activation_expiration_date: null,
    token: overrides.token ?? null,
    status: overrides.status ?? 'NOT_REGISTERED',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.3.1-oia-registration', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.3.1-oia-registration.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.3.1 schema', async () => {
    await insertRegistration(db);
    await up(db); // must not throw
  });

  it('recreates the registrations table keeping every previously existing column', async () => {
    await insertRegistration(db);
    await up(db);
    const cols = await columnNames(db, 'registrations');
    for (const expected of [
      'id',
      'created_at',
      'updated_at',
      'host',
      'use_proxy',
      'proxy_url',
      'proxy_username',
      'proxy_password',
      'accept_unauthorized',
      'activation_code',
      'check_url',
      'activation_date',
      'activation_expiration_date',
      'token',
      'status'
    ]) {
      assert.ok(cols.includes(expected), `registrations.${expected} preserved`);
    }
  });

  it('preserves existing registration row data', async () => {
    await insertRegistration(db, { id: 'registration-2', host: 'https://oia2.example.com', token: 'tok-1', status: 'REGISTERED' });

    await up(db);

    const row = await db('registrations').where('id', 'registration-2').first();
    assert.strictEqual(row.host, 'https://oia2.example.com');
    assert.strictEqual(row.token, 'tok-1');
    assert.strictEqual(row.status, 'REGISTERED');
  });

  it('adds a unique constraint on (activation_code, check_url, host)', async () => {
    await insertRegistration(db, {
      id: 'registration-1',
      host: 'https://oia.example.com',
      activation_code: 'ABC',
      check_url: 'https://check'
    });

    await up(db);

    await assert.rejects(
      () =>
        db('registrations').insert({
          id: 'registration-duplicate',
          host: 'https://oia.example.com',
          use_proxy: 0,
          accept_unauthorized: '0',
          activation_code: 'ABC',
          check_url: 'https://check',
          status: 'NOT_REGISTERED',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }),
      'inserting the same (activation_code, check_url, host) combo violates the new unique constraint'
    );
  });

  it('down is a no-op', async () => {
    await insertRegistration(db);
    await up(db);
    await down(db);
    const row = await db('registrations').first();
    assert.ok(row, 'registrations table and data remain untouched by down');
  });
});
