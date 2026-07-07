import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.6.0';

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

/** Build the real schema as it exists just before v3.6.0 by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.6.0');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({ id, name: `Scan ${id}`, description: '', cron: '* * * * * *' });
}

async function insertSouthConnector(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'south-1',
    name: 'South 1',
    type: 'mssql',
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

async function insertNorthConnector(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'north-1',
    name: 'North 1',
    type: 'oianalytics',
    description: '',
    enabled: 1,
    settings: '{}',
    caching_scan_mode_id: 'scan-mode-1',
    caching_group_count: 100,
    caching_retry_interval: 1000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('north_connectors').insert(row);
  return row;
}

async function insertSubscription(db: Knex, northId: string, southId: string) {
  await db('subscription').insert({
    north_connector_id: northId,
    south_connector_id: southId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertHistoryQuery(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'history-1',
    name: 'History 1',
    description: '',
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: 'mssql',
    north_type: 'oianalytics',
    south_settings: '{}',
    north_settings: '{}',
    caching_scan_mode_id: 'scan-mode-1',
    caching_group_count: 100,
    caching_retry_interval: 1000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('history_queries').insert(row);
  return row;
}

async function insertHistoryItem(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'history-item-1',
    history_id: 'history-1',
    name: 'History item 1',
    enabled: 1,
    settings: '{}',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('history_items').insert(row);
  return row;
}

describe('Entity migration v3.6.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v360-'));
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

  it('runs end-to-end on a realistic pre-3.6.0 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('oianalytics_messages history_id column', () => {
    it('adds the history_id column', async () => {
      await up(db);
      const cols = await columnNames(db, 'oianalytics_messages');
      assert.ok(cols.includes('history_id'), 'oianalytics_messages.history_id added');
    });
  });

  describe('commands new columns', () => {
    it('adds certificate_id, ip_filter_id, history_id and item_id columns', async () => {
      await up(db);
      const cols = await columnNames(db, 'commands');
      assert.ok(cols.includes('certificate_id'));
      assert.ok(cols.includes('ip_filter_id'));
      assert.ok(cols.includes('history_id'));
      assert.ok(cols.includes('item_id'));
    });
  });

  describe('registrations command_test_* columns', () => {
    it('adds the columns and sets them to true for existing rows', async () => {
      await db('registrations').insert({
        id: 'registration-1',
        host: 'https://example.com',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'registrations');
      assert.ok(cols.includes('command_test_south_connection'));
      assert.ok(cols.includes('command_test_south_item'));
      assert.ok(cols.includes('command_test_north_connection'));
      assert.ok(cols.includes('command_test_history_north_connection'));
      assert.ok(cols.includes('command_test_history_south_connection'));
      assert.ok(cols.includes('command_test_history_south_item'));

      const row = await db('registrations').where('id', 'registration-1').first();
      assert.strictEqual(row.command_test_south_connection, 1);
      assert.strictEqual(row.command_test_south_item, 1);
      assert.strictEqual(row.command_test_north_connection, 1);
      assert.strictEqual(row.command_test_history_north_connection, 1);
      assert.strictEqual(row.command_test_history_south_connection, 1);
      assert.strictEqual(row.command_test_history_south_item, 1);
    });
  });

  describe('north_connectors caching column rename', () => {
    it('renames the caching columns and adds the new throttling/error-retention columns', async () => {
      await insertScanMode(db);
      await insertNorthConnector(db, { caching_send_file_immediately: 1 });

      await up(db);

      const cols = await columnNames(db, 'north_connectors');
      assert.ok(cols.includes('caching_trigger_schedule'));
      assert.ok(cols.includes('caching_trigger_number_of_elements'));
      assert.ok(cols.includes('caching_throttling_cache_max_size'));
      assert.ok(cols.includes('caching_throttling_max_number_of_elements'));
      assert.ok(cols.includes('caching_trigger_number_of_files'));
      assert.ok(cols.includes('caching_error_retry_interval'));
      assert.ok(cols.includes('caching_error_retry_count'));
      assert.ok(cols.includes('caching_archive_enabled'));
      assert.ok(cols.includes('caching_archive_retention_duration'));
      assert.ok(cols.includes('caching_throttling_run_min_delay'));
      assert.ok(cols.includes('caching_error_retention_duration'));
      assert.ok(!cols.includes('caching_scan_mode_id'));
      assert.ok(!cols.includes('caching_group_count'));
      assert.ok(!cols.includes('caching_max_size'));
      assert.ok(!cols.includes('caching_max_send_count'));
      assert.ok(!cols.includes('caching_send_file_immediately'));
      assert.ok(!cols.includes('caching_retry_interval'));
      assert.ok(!cols.includes('caching_retry_count'));
      assert.ok(!cols.includes('archive_enabled'));
      assert.ok(!cols.includes('archive_retention_duration'));

      const row = await db('north_connectors').where('id', 'north-1').first();
      assert.strictEqual(row.caching_trigger_number_of_files, 1, 'cast from the old boolean-ish column');
      assert.strictEqual(row.caching_throttling_run_min_delay, 200);
      assert.strictEqual(row.caching_error_retention_duration, 0);
    });
  });

  describe('history_queries caching column rename', () => {
    it('renames the caching columns and derives caching_trigger_number_of_files from the group count', async () => {
      await insertScanMode(db);
      await insertHistoryQuery(db, { caching_group_count: 5, caching_send_file_immediately: 1 });

      await up(db);

      const cols = await columnNames(db, 'history_queries');
      assert.ok(cols.includes('caching_trigger_schedule'));
      assert.ok(cols.includes('caching_trigger_number_of_elements'));
      assert.ok(cols.includes('caching_throttling_run_min_delay'));
      assert.ok(cols.includes('caching_error_retention_duration'));
      assert.ok(!cols.includes('caching_scan_mode_id'));
      assert.ok(!cols.includes('caching_group_count'));

      const row = await db('history_queries').where('id', 'history-1').first();
      assert.strictEqual(row.caching_trigger_number_of_elements, 5);
      assert.strictEqual(row.caching_trigger_number_of_files, 5, 'derived from caching_trigger_number_of_elements, not the old boolean');
      assert.strictEqual(row.caching_throttling_run_min_delay, 200);
      assert.strictEqual(row.caching_error_retention_duration, 0);
    });
  });

  describe('south mqtt settings rewrite', () => {
    it('adds maxNumberOfMessages and flushMessageTimeout while preserving existing fields', async () => {
      await insertSouthConnector(db, {
        id: 'south-mqtt',
        type: 'mqtt',
        settings: JSON.stringify({
          url: 'mqtt://localhost',
          qos: '1',
          authentication: { type: 'none' },
          rejectUnauthorized: false,
          reconnectPeriod: 1000,
          connectTimeout: 1000
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-mqtt').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.url, 'mqtt://localhost');
      assert.strictEqual(settings.maxNumberOfMessages, 1000);
      assert.strictEqual(settings.flushMessageTimeout, 1000);
    });
  });

  describe('south / history opc settings rewrite', () => {
    it('adds mode "hda" to an opc south connector', async () => {
      await insertSouthConnector(db, {
        id: 'south-opc',
        type: 'opc',
        settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: false },
          agentUrl: 'http://localhost',
          retryInterval: 1000,
          host: 'localhost',
          serverName: 'server'
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-opc').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.mode, 'hda');
      assert.strictEqual(settings.host, 'localhost');
    });

    it('adds mode "hda" to an opc history query south_settings', async () => {
      await insertScanMode(db);
      await insertHistoryQuery(db, {
        id: 'history-opc',
        south_type: 'opc',
        south_settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: false },
          agentUrl: 'http://localhost',
          retryInterval: 1000,
          host: 'localhost',
          serverName: 'server'
        })
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-opc').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.mode, 'hda');
    });
  });

  describe('removeSouthSLIMS', () => {
    it('deletes slims south connectors along with their items and subscriptions', async () => {
      await insertScanMode(db);
      await insertNorthConnector(db, { id: 'north-slims', name: 'North slims' });
      await insertSouthConnector(db, { id: 'south-slims', name: 'South slims', type: 'slims' });
      await insertSouthItem(db, { id: 'south-item-slims', connector_id: 'south-slims', name: 'Slims item' });
      await insertSubscription(db, 'north-slims', 'south-slims');

      await up(db);

      const connector = await db('south_connectors').where('id', 'south-slims').first();
      assert.strictEqual(connector, undefined, 'slims south connector removed');
      const item = await db('south_items').where('id', 'south-item-slims').first();
      assert.strictEqual(item, undefined, 'slims south item removed');
      const subscription = await db('subscription').where('south_connector_id', 'south-slims').first();
      assert.strictEqual(subscription, undefined, 'slims subscription removed');
    });

    it('deletes slims history queries along with their history items', async () => {
      await insertScanMode(db);
      await insertHistoryQuery(db, { id: 'history-slims', name: 'History slims', south_type: 'slims' });
      await insertHistoryItem(db, { id: 'history-item-slims', history_id: 'history-slims' });

      await up(db);

      const history = await db('history_queries').where('id', 'history-slims').first();
      assert.strictEqual(history, undefined, 'slims history query removed');
      const item = await db('history_items').where('id', 'history-item-slims').first();
      assert.strictEqual(item, undefined, 'slims history item removed');
    });

    it('leaves non-slims south connectors and history queries untouched', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, { id: 'south-keep', name: 'South keep', type: 'mssql' });
      await insertHistoryQuery(db, { id: 'history-keep', name: 'History keep', south_type: 'mssql' });

      await up(db);

      const connector = await db('south_connectors').where('id', 'south-keep').first();
      assert.ok(connector, 'non-slims south connector preserved');
      const history = await db('history_queries').where('id', 'history-keep').first();
      assert.ok(history, 'non-slims history query preserved');
    });
  });
});
