import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.3.1-oia-registration';

const TARGET_BASENAME = 'v3.3.1-oia-registration.ts';

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

/** Build the real schema as it exists just before this migration by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < TARGET_BASENAME);
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

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
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v331-'));
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
