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
