import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.3.12-add-azure-blob-proxy';

const TARGET_BASENAME = 'v3.3.12-add-azure-blob-proxy.ts';

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

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({
    id,
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *'
  });
}

async function insertNorthConnector(db: Knex, id: string, type: string, settings: unknown, scanModeId: string) {
  await db('north_connectors').insert({
    id,
    name: `Test ${type} ${id}`,
    type,
    description: '',
    enabled: 1,
    settings: JSON.stringify(settings),
    caching_scan_mode_id: scanModeId,
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.3.12-add-azure-blob-proxy', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v3312-'));
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

  it('runs end-to-end on a realistic pre-3.3.12 schema', async () => {
    await up(db); // must not throw
  });

  it('adds useProxy, useCustomUrl and customUrl to azure-blob north connector settings, preserving old fields', async () => {
    const oldSettings = {
      account: 'myaccount',
      container: 'mycontainer',
      path: null,
      authentication: 'access-key',
      accessKey: 'secret-key'
    };
    await insertNorthConnector(db, 'azure-1', 'azure-blob', oldSettings, 'scan-mode-1');

    await up(db);

    const row = await db('north_connectors').where('id', 'azure-1').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.account, 'myaccount', 'existing settings are preserved');
    assert.strictEqual(settings.container, 'mycontainer');
    assert.strictEqual(settings.accessKey, 'secret-key');
    assert.strictEqual(settings.useProxy, false);
    assert.strictEqual(settings.useCustomUrl, false);
    assert.strictEqual(settings.customUrl, '');
  });

  it('does not touch settings of north connectors of other types', async () => {
    const oldSettings = { outputFolder: 'output', prefix: null, suffix: null };
    await insertNorthConnector(db, 'file-writer-1', 'file-writer', oldSettings, 'scan-mode-1');

    await up(db);

    const row = await db('north_connectors').where('id', 'file-writer-1').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, oldSettings, 'non azure-blob settings are left untouched');
  });

  it('down is a no-op', async () => {
    const oldSettings = { account: 'myaccount', container: 'mycontainer', path: null, authentication: 'sas-token', sasToken: 'token' };
    await insertNorthConnector(db, 'azure-2', 'azure-blob', oldSettings, 'scan-mode-1');

    await up(db);
    await down(db);

    const row = await db('north_connectors').where('id', 'azure-2').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.useProxy, false, 'down does not revert the up() migration');
  });
});
