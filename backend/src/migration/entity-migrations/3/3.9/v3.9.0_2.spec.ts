import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { down, up } from './v3.9.0_2';

/** Build the schema as it exists just before v3.9.0_2 by running every prior entity migration in order. */
async function buildPreV3902Schema(db: Knex): Promise<void> {
  const entityRoot = path.resolve(__dirname, '..', '..');
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
  const priorFiles = collect(entityRoot)
    .sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0))
    .filter(f => f.file < 'v3.9.0_2');

  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.9.0_2', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v3902-'));
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
    await buildPreV3902Schema(db);
    await db('certificates').insert({
      id: 'test-certificate-id',
      name: 'Test Certificate',
      public_key: 'public key',
      private_key: 'private key',
      certificate: 'certificate',
      expiry: '2026-01-01T00:00:00Z'
    });
  });

  describe('up', () => {
    it('adds the certificate_chain column to certificates', async () => {
      await up(db);
      const cols = await columnNames(db, 'certificates');
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
      const cols = await columnNames(db, 'certificates');
      assert.ok(!cols.includes('certificate_chain'), 'certificates.certificate_chain removed');
    });
  });

  it('is reversible: up → down → up produces the column again', async () => {
    await up(db);
    await down(db);
    await up(db);

    const cols = await columnNames(db, 'certificates');
    assert.ok(cols.includes('certificate_chain'), 'certificates.certificate_chain added');
  });
});
