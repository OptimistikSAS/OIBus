import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.3.12-add-azure-blob-proxy';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

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
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.3.12-add-azure-blob-proxy.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await insertScanMode(db);
  });
  afterEach(() => harness.afterEach());

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

  it('down resolves without touching the database, even when called without a prior up()', async () => {
    const result = await down(db);
    assert.strictEqual(result, undefined, 'down() resolves with no return value');
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
