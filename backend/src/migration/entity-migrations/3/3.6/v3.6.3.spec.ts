import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.6.3';

/**
 * Collect every entity migration file (excluding specs) under the entity-migrations root,
 * sorted lexicographically by filename - the same order OIBus's migration runner uses.
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

/** Build the real schema as it exists just before v3.6.3 by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.6.3');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({ id, name: `Scan ${id}`, description: '', cron: '* * * * * *' });
}

async function insertSouthConnector(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'south-1',
    name: 'South 1',
    type: 'opcua',
    description: '',
    enabled: 1,
    settings: '{}',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('south_connectors').insert(row);
  return row;
}

async function insertSouthItem(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'south-item-1',
    connector_id: 'south-1',
    scan_mode_id: 'scan-mode-1',
    name: 'Item 1',
    enabled: 1,
    settings: '{}',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('south_items').insert(row);
  return row;
}

describe('Entity migration v3.6.3', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v363-'));
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
    await insertScanMode(db);
  });

  it('runs end-to-end on a realistic pre-3.6.3 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('updateSouthOPCUAItemSettings', () => {
    it("adds timestampOrigin 'oibus' to a 'da' mode item of an opcua connector", async () => {
      await insertSouthConnector(db, { id: 'south-opcua', type: 'opcua' });
      await insertSouthItem(db, {
        id: 'item-da',
        connector_id: 'south-opcua',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'da' })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-da').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.nodeId, 'ns=1;s=node', 'existing settings preserved');
      assert.strictEqual(settings.timestampOrigin, 'oibus');
    });

    it("leaves a 'ha' mode item of an opcua connector untouched", async () => {
      await insertSouthConnector(db, { id: 'south-opcua', type: 'opcua' });
      await insertSouthItem(db, {
        id: 'item-ha',
        connector_id: 'south-opcua',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'ha', haMode: { aggregate: 'raw' } })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-ha').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.timestampOrigin, undefined, "'ha' mode items are not modified");
    });

    it('does not touch items belonging to a non-opcua connector', async () => {
      await insertSouthConnector(db, { id: 'south-mssql', type: 'mssql' });
      await insertSouthItem(db, {
        id: 'item-mssql',
        connector_id: 'south-mssql',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'da' })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.timestampOrigin, undefined, 'non-opcua connector items are not modified');
    });
  });
});
