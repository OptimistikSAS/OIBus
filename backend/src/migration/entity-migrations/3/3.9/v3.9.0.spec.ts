import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up } from './v3.9.0';

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

/** Build the real schema as it exists just before v3.9.0 by running every prior migration in order. */
async function buildPreV390Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.9.0');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.9.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v390-'));
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
    await buildPreV390Schema(db);
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
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
      oibus_version: '3.8.0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  it('runs end-to-end on a realistic pre-3.9.0 schema', async () => {
    await up(db); // must not throw
  });

  it('creates the table with the expected columns', async () => {
    await up(db);
    const cols = await columnNames(db, 'engines');
    assert.ok(cols.includes('log_syslog_level'), 'engines.log_syslog_level added');
    assert.ok(cols.includes('log_syslog_host'), 'engines.log_syslog_host added');
    assert.ok(cols.includes('log_syslog_port'), 'engines.log_syslog_port added');
    assert.ok(cols.includes('log_syslog_protocol'), 'engines.log_syslog_protocol added');
    assert.ok(cols.includes('forward_proxy_url'), 'engines.forward_proxy_url added');
    assert.ok(cols.includes('forward_proxy_username'), 'engines.forward_proxy_username added');
    assert.ok(cols.includes('forward_proxy_password'), 'engines.forward_proxy_password added');
    assert.ok(cols.includes('proxy_username'), 'engines.proxy_username added');
    assert.ok(cols.includes('proxy_password'), 'engines.proxy_password added');
  });

  it('leaves proxy auth columns null by default', async () => {
    await up(db);
    const row = await db('engines').first();
    assert.strictEqual(row.proxy_username, null);
    assert.strictEqual(row.proxy_password, null);
  });

  it('populates syslog defaults on existing rows', async () => {
    const row = await db('engines').first();
    await up(db);
    const updated = await db('engines').where('id', row.id).first();
    assert.strictEqual(updated.log_syslog_level, 'silent');
    assert.strictEqual(updated.log_syslog_host, '');
    assert.strictEqual(updated.log_syslog_port, 514);
    assert.strictEqual(updated.log_syslog_protocol, 'udp4');
  });

  it('leaves forward proxy columns null by default', async () => {
    await up(db);
    const row = await db('engines').first();
    assert.strictEqual(row.forward_proxy_url, null);
    assert.strictEqual(row.forward_proxy_username, null);
    assert.strictEqual(row.forward_proxy_password, null);
  });
});
