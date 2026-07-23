import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.2.0-oia-registration';

const THIS_FILE = 'v3.2.0-oia-registration.ts';

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
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertSouthConnector(db: Knex, id: string, type: string, settings: unknown) {
  await db('south_connectors').insert({
    id,
    name: `South ${id}`,
    type,
    enabled: true,
    settings: JSON.stringify(settings),
    history_max_instant_per_item: 1,
    history_max_read_interval: 3600,
    history_read_delay: 200
  });
}

async function insertNorthConnector(db: Knex, id: string, type: string, settings: unknown) {
  await db('north_connectors').insert({
    id,
    name: `North ${id}`,
    type,
    enabled: true,
    settings: JSON.stringify(settings),
    caching_scan_mode_id: 'scan-mode-1',
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 30,
    archive_enabled: 0,
    archive_retention_duration: 720
  });
}

async function insertHistoryQuery(
  db: Knex,
  id: string,
  southType: string,
  northType: string,
  southSettings: unknown,
  northSettings: unknown
) {
  await db('history_queries').insert({
    id,
    name: `History ${id}`,
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: southType,
    north_type: northType,
    south_settings: JSON.stringify(southSettings),
    north_settings: JSON.stringify(northSettings),
    history_max_instant_per_item: 1,
    history_max_read_interval: 3600,
    history_read_delay: 200,
    caching_scan_mode_id: 'scan-mode-1',
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 30,
    archive_enabled: 0,
    archive_retention_duration: 720
  });
}

describe('Entity migration v3.2.0-oia-registration', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v320-'));
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
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', cron: '*/10 * * * * *' });
    await db('engines').insert({ id: 'engine-1' });
  });

  it('runs end-to-end on a realistic pre-3.2.0 schema', async () => {
    await up(db); // must not throw
  });

  describe('registrations table', () => {
    it('creates the registrations table with the expected columns', async () => {
      await up(db);
      assert.ok(await db.schema.hasTable('registrations'));
      const cols = await columnNames(db, 'registrations');
      for (const col of [
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
        assert.ok(cols.includes(col), `registrations.${col} exists`);
      }
    });

    it('defaults status to NOT_REGISTERED', async () => {
      await up(db);
      await db('registrations').insert({ id: 'reg-1', host: 'https://oia.example.com' });
      const row = await db('registrations').where('id', 'reg-1').first();
      assert.strictEqual(row.status, 'NOT_REGISTERED');
      assert.strictEqual(row.use_proxy, 0);
    });
  });

  describe('commands table', () => {
    it('creates the commands table with the expected columns', async () => {
      await up(db);
      assert.ok(await db.schema.hasTable('commands'));
      const cols = await columnNames(db, 'commands');
      for (const col of ['type', 'status', 'ack', 'retrieved_date', 'completed_date', 'result', 'upgrade_version', 'upgrade_asset_id']) {
        assert.ok(cols.includes(col), `commands.${col} exists`);
      }
    });

    it('defaults ack to false', async () => {
      await up(db);
      await db('commands').insert({ id: 'command-1', type: 'upgrade', status: 'PENDING' });
      const row = await db('commands').where('id', 'command-1').first();
      assert.strictEqual(row.ack, 0);
    });
  });

  describe('engines settings', () => {
    it('adds proxy and OIA logging columns, and drops log_loki_token_address', async () => {
      await up(db);
      const cols = await columnNames(db, 'engines');
      assert.ok(cols.includes('proxy_enabled'));
      assert.ok(cols.includes('proxy_port'));
      assert.ok(cols.includes('log_oia_level'));
      assert.ok(cols.includes('log_oia_interval'));
      assert.ok(!cols.includes('log_loki_token_address'), 'log_loki_token_address dropped');
    });

    it('backfills defaults for existing engine rows', async () => {
      await up(db);
      const row = await db('engines').where('id', 'engine-1').first();
      assert.strictEqual(row.proxy_enabled, 0);
      assert.strictEqual(row.proxy_port, 9000);
      assert.strictEqual(row.log_oia_level, 'silent');
      assert.strictEqual(row.log_oia_interval, 10);
    });
  });

  describe('north oianalytics connector settings migration', () => {
    it('rewrites settings for a north oianalytics connector with proxy and secrets set', async () => {
      await insertNorthConnector(db, 'north-1', 'oianalytics', {
        host: 'https://oia.example.com',
        acceptUnauthorized: false,
        timeout: 30,
        authentication: 'aad-client-secret',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        tenantId: 'tenant-id',
        useProxy: true,
        proxyUrl: 'http://proxy:8080',
        proxyUsername: 'proxy-user',
        proxyPassword: 'proxy-pass'
      });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.useOiaModule, false);
      assert.strictEqual(settings.timeout, 30);
      assert.strictEqual(settings.compress, false);
      assert.strictEqual(settings.specificSettings.host, 'https://oia.example.com');
      assert.strictEqual(settings.specificSettings.authentication, 'aad-client-secret');
      assert.strictEqual(settings.specificSettings.clientId, 'client-id');
      assert.strictEqual(settings.specificSettings.clientSecret, 'client-secret');
      assert.strictEqual(settings.specificSettings.useProxy, true);
      assert.strictEqual(settings.specificSettings.proxyUrl, 'http://proxy:8080');
    });

    it('rewrites settings for a north oianalytics connector without proxy or optional secrets', async () => {
      await insertNorthConnector(db, 'north-2', 'oianalytics', {
        host: 'https://oia.example.com',
        acceptUnauthorized: true,
        timeout: 15,
        authentication: 'basic',
        accessKey: 'key',
        secretKey: null,
        useProxy: false
      });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-2').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.specificSettings.accessKey, 'key');
      assert.strictEqual(settings.specificSettings.secretKey, undefined);
      assert.strictEqual(settings.specificSettings.tenantId, undefined);
      assert.strictEqual(settings.specificSettings.useProxy, false);
    });

    it('does not touch settings of north connectors of other types', async () => {
      await insertNorthConnector(db, 'north-3', 'file-writer', { outputFolder: 'output' });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-3').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.outputFolder, 'output');
      assert.strictEqual(settings.useOiaModule, undefined);
    });
  });

  describe('south oianalytics connector settings migration', () => {
    it('rewrites settings for a south oianalytics connector, forcing basic authentication', async () => {
      await insertSouthConnector(db, 'south-1', 'oianalytics', {
        host: 'https://oia.example.com',
        acceptUnauthorized: false,
        timeout: 30,
        accessKey: 'key',
        secretKey: 'secret',
        useProxy: true,
        proxyUrl: 'http://proxy:8080',
        proxyUsername: 'proxy-user',
        proxyPassword: 'proxy-pass'
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.useOiaModule, false);
      assert.strictEqual(settings.timeout, 30);
      assert.strictEqual(settings.specificSettings.host, 'https://oia.example.com');
      assert.strictEqual(settings.specificSettings.authentication, 'basic');
      assert.strictEqual(settings.specificSettings.accessKey, 'key');
      assert.strictEqual(settings.specificSettings.secretKey, 'secret');
      assert.strictEqual(settings.specificSettings.useProxy, true);
    });

    it('rewrites settings for a south oianalytics connector without proxy', async () => {
      await insertSouthConnector(db, 'south-2', 'oianalytics', {
        host: 'https://oia.example.com',
        acceptUnauthorized: true,
        timeout: 15,
        accessKey: 'key',
        secretKey: null,
        useProxy: false
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-2').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.specificSettings.useProxy, false);
      assert.strictEqual(settings.specificSettings.proxyUrl, undefined);
    });

    it('does not touch settings of south connectors of other types', async () => {
      await insertSouthConnector(db, 'south-3', 'mssql', { host: 'db-host', port: 1433 });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-3').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.host, 'db-host');
      assert.strictEqual(settings.useOiaModule, undefined);
    });
  });

  describe('history query oianalytics settings migration', () => {
    it('rewrites north_settings for a history query with an oianalytics north', async () => {
      await insertHistoryQuery(
        db,
        'history-1',
        'mssql',
        'oianalytics',
        { host: 'db-host', port: 1433 },
        {
          host: 'https://oia.example.com',
          acceptUnauthorized: false,
          timeout: 30,
          authentication: 'aad-certificate',
          certificateId: 'cert-1',
          useProxy: true,
          proxyUrl: 'http://proxy:8080'
        }
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-1').first();
      const northSettings = JSON.parse(row.north_settings);
      assert.strictEqual(northSettings.useOiaModule, false);
      assert.strictEqual(northSettings.specificSettings.authentication, 'aad-certificate');
      assert.strictEqual(northSettings.specificSettings.certificateId, 'cert-1');
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.host, 'db-host', 'south_settings of a non-oianalytics south is untouched');
    });

    it('rewrites south_settings for a history query with an oianalytics south, forcing basic authentication', async () => {
      await insertHistoryQuery(
        db,
        'history-2',
        'oianalytics',
        'file-writer',
        {
          host: 'https://oia.example.com',
          acceptUnauthorized: true,
          timeout: 15,
          accessKey: 'key',
          secretKey: 'secret',
          useProxy: false
        },
        { outputFolder: 'output' }
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-2').first();
      const southSettings = JSON.parse(row.south_settings);
      assert.strictEqual(southSettings.useOiaModule, false);
      assert.strictEqual(southSettings.specificSettings.authentication, 'basic');
      assert.strictEqual(southSettings.specificSettings.accessKey, 'key');
      const northSettings = JSON.parse(row.north_settings);
      assert.strictEqual(northSettings.outputFolder, 'output', 'north_settings of a non-oianalytics north is untouched');
    });

    it('does not touch history queries with neither side using oianalytics', async () => {
      await insertHistoryQuery(db, 'history-3', 'mssql', 'file-writer', { host: 'db-host' }, { outputFolder: 'output' });

      await up(db);

      const row = await db('history_queries').where('id', 'history-3').first();
      const southSettings = JSON.parse(row.south_settings);
      const northSettings = JSON.parse(row.north_settings);
      assert.strictEqual(southSettings.host, 'db-host');
      assert.strictEqual(northSettings.outputFolder, 'output');
    });
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    assert.ok(await db.schema.hasTable('registrations'), 'down does not revert the migration');
  });
});
