import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { down, up } from './v3.10.0_1';

/** Build the schema as it exists just before v3.10.0_1 by running every prior entity migration in order. */
async function buildPreMigrationSchema(db: Knex): Promise<void> {
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
    .filter(f => f.file < 'v3.10.0_1');

  for (const { full } of priorFiles) {
    const migration = (await import(pathToFileURL(full).href)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.10.0_1', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db);
    await db('scan_modes').insert([
      { id: 'sm1', name: 'Every minute', description: 'Trigger every minute', cron: '0 * * * * *' },
      { id: 'sm2', name: 'Every hour', description: 'Trigger every hour', cron: '0 0 * * * *' },
      // The reserved push-driven row, whose cron is empty.
      { id: 'subscription', name: 'Subscription', description: 'Used for subscription', cron: '' }
    ]);
    await db('certificates').insert({
      id: 'test-certificate-id',
      name: 'Test Certificate',
      public_key: 'public key',
      private_key: 'private key',
      certificate: 'certificate',
      expiry: '2026-01-01T00:00:00Z'
    });
  });

  describe('scan_modes', () => {
    it('should add the type, interval and activation window columns', async () => {
      await up(db);

      const columns = await columnNames(db, 'scan_modes');
      assert.ok(columns.includes('type'));
      assert.ok(columns.includes('interval'));
      assert.ok(columns.includes('activation_window'));
    });

    it('should backfill every existing scan mode as cron', async () => {
      await up(db);

      const rows = await db('scan_modes').select('id', 'type').orderBy('id');
      assert.deepStrictEqual(
        rows.map(row => row.type),
        ['sm1', 'sm2', 'subscription'].map(() => 'cron')
      );
    });

    it('should leave interval and activation window empty', async () => {
      await up(db);

      const rows = await db('scan_modes').select('interval', 'activation_window');
      for (const row of rows) {
        assert.strictEqual(row.interval, null);
        assert.strictEqual(row.activation_window, null);
      }
    });

    it('should drop the columns on down', async () => {
      await up(db);
      await down(db);

      const columns = await columnNames(db, 'scan_modes');
      assert.ok(!columns.includes('type'));
      assert.ok(!columns.includes('interval'));
      assert.ok(!columns.includes('activation_window'));
      // The rows themselves survive the rollback.
      assert.strictEqual((await db('scan_modes').select('id')).length, 3);
    });

    it('should be re-appliable after a rollback', async () => {
      await up(db);
      await down(db);
      await up(db);

      const rows = await db('scan_modes').select('type');
      assert.ok(rows.every(row => row.type === 'cron'));
    });
  });

  describe('certificates', () => {
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
});
