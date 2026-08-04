import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.1.1-add-certificates-table';

const THIS_FILE = 'v3.1.1-add-certificates-table.ts';

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
  const priorFiles = entityMigrationFiles().filter(f => f.file < THIS_FILE);
  for (const { full } of priorFiles) {
    const migration = (await import(pathToFileURL(full).href)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.1.1-add-certificates-table', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPriorSchema(db);
  });

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
