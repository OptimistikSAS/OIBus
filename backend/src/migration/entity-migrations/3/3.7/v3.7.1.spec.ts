import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.7.1';

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

/** Build the real schema as it exists just before v3.7.1 by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.7.1');
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
    type: 'modbus',
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

// north_connectors at this point already has the caching_* columns renamed by v3.6.0
async function insertNorthConnector(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'north-1',
    name: 'North 1',
    type: 'modbus',
    description: '',
    enabled: 1,
    settings: '{}',
    caching_trigger_schedule: 'scan-mode-1',
    caching_trigger_number_of_elements: 100,
    caching_error_retry_interval: 1000,
    caching_error_retry_count: 3,
    caching_throttling_max_number_of_elements: 1000,
    caching_trigger_number_of_files: 1,
    caching_throttling_cache_max_size: 0,
    caching_archive_enabled: 0,
    caching_archive_retention_duration: 0,
    caching_throttling_run_min_delay: 200,
    caching_error_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('north_connectors').insert(row);
  return row;
}

// history_queries at this point already has the caching_* columns renamed by v3.6.0
async function insertHistoryQuery(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'history-1',
    name: 'History 1',
    description: '',
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: 'opcua',
    north_type: 'oianalytics',
    south_settings: '{}',
    north_settings: '{}',
    caching_trigger_schedule: 'scan-mode-1',
    caching_trigger_number_of_elements: 100,
    caching_error_retry_interval: 1000,
    caching_error_retry_count: 3,
    caching_throttling_max_number_of_elements: 1000,
    caching_trigger_number_of_files: 1,
    caching_throttling_cache_max_size: 0,
    caching_archive_enabled: 0,
    caching_archive_retention_duration: 0,
    caching_throttling_run_min_delay: 200,
    caching_error_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('history_queries').insert(row);
  return row;
}

describe('Entity migration v3.7.1', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v371-'));
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

  it('runs end-to-end on a realistic pre-3.7.1 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('removeCommandsEnum', () => {
    it('keeps type and status as string columns and preserves existing values', async () => {
      await db('commands').insert({
        id: 'command-1',
        type: 'update-version',
        status: 'COMPLETED',
        ack: 0,
        target_version: 'v3.7.1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'commands');
      assert.ok(cols.includes('type'));
      assert.ok(cols.includes('status'));
      assert.ok(!cols.includes('type_old'));
      assert.ok(!cols.includes('status_old'));

      const row = await db('commands').where('id', 'command-1').first();
      assert.strictEqual(row.type, 'update-version');
      assert.strictEqual(row.status, 'COMPLETED');
    });
  });

  describe('removeEngineLogEnum', () => {
    it('keeps the log level columns as strings and preserves existing values', async () => {
      await db('engines').insert({
        id: 'engine-1',
        name: 'OIBus',
        log_console_level: 'debug',
        log_file_level: 'info',
        log_database_level: 'error',
        log_loki_level: 'warning',
        log_oia_level: 'silent',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'engines');
      assert.ok(cols.includes('log_console_level'));
      assert.ok(!cols.includes('log_console_level_old'));
      assert.ok(!cols.includes('log_oia_level_old'));

      const row = await db('engines').where('id', 'engine-1').first();
      assert.strictEqual(row.log_console_level, 'debug');
      assert.strictEqual(row.log_file_level, 'info');
      assert.strictEqual(row.log_database_level, 'error');
      assert.strictEqual(row.log_loki_level, 'warning');
      assert.strictEqual(row.log_oia_level, 'silent');
    });
  });

  describe('removeRegistrationEnum', () => {
    it('keeps status as a string column and preserves the existing value even though it runs twice', async () => {
      await db('registrations').insert({
        id: 'registration-1',
        host: 'https://example.com',
        status: 'REGISTERED',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'registrations');
      assert.ok(cols.includes('status'));
      assert.ok(!cols.includes('status_old'));

      const row = await db('registrations').where('id', 'registration-1').first();
      assert.strictEqual(row.status, 'REGISTERED');
    });
  });

  describe('removeOIAnalyticsMessagesEnum', () => {
    it('keeps status as a string column and preserves the existing value', async () => {
      await db('oianalytics_messages').insert({
        id: 'message-1',
        type: 'info',
        status: 'ERRORED',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'oianalytics_messages');
      assert.ok(cols.includes('status'));
      assert.ok(!cols.includes('status_old'));

      const row = await db('oianalytics_messages').where('id', 'message-1').first();
      assert.strictEqual(row.status, 'ERRORED');
    });
  });

  describe('addModbusConnectionTimeout', () => {
    it('adds connectTimeout to a modbus south connector', async () => {
      await insertSouthConnector(db, {
        id: 'south-modbus',
        type: 'modbus',
        settings: JSON.stringify({
          host: 'localhost',
          port: 502,
          retryInterval: 1000,
          slaveId: 1,
          addressOffset: 'modbus',
          endianness: 'big-endian',
          swapBytesInWords: false,
          swapWordsInDWords: false
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-modbus').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.host, 'localhost', 'existing settings preserved');
      assert.strictEqual(settings.connectTimeout, 10000);
    });

    it('adds connectTimeout to a modbus north connector', async () => {
      await insertNorthConnector(db, {
        id: 'north-modbus',
        type: 'modbus',
        settings: JSON.stringify({
          host: 'localhost',
          port: 502,
          retryInterval: 1000,
          slaveId: 1,
          addressOffset: 'modbus',
          endianness: 'big-endian',
          swapBytesInWords: false,
          swapWordsInDWords: false
        })
      });

      await up(db);

      const row = await db('north_connectors').where('id', 'north-modbus').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.connectTimeout, 10000);
    });

    it('does not touch settings of connectors of other types', async () => {
      await insertSouthConnector(db, {
        id: 'south-mssql',
        type: 'mssql',
        settings: JSON.stringify({ host: 'localhost' })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.connectTimeout, undefined);
    });
  });

  describe('addOPCUAFlushSettings', () => {
    it('adds flushMessageTimeout and maxNumberOfMessages to an opcua south connector', async () => {
      await insertSouthConnector(db, {
        id: 'south-opcua',
        type: 'opcua',
        settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: false },
          sharedConnection: false,
          url: 'opc.tcp://localhost',
          keepSessionAlive: false,
          readTimeout: 15000,
          retryInterval: 1000,
          securityMode: 'none',
          authentication: { type: 'none' }
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-opcua').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.url, 'opc.tcp://localhost', 'existing settings preserved');
      assert.strictEqual(settings.flushMessageTimeout, 1000);
      assert.strictEqual(settings.maxNumberOfMessages, 1000);
    });

    it('adds flushMessageTimeout and maxNumberOfMessages to an opcua history query south_settings', async () => {
      await insertHistoryQuery(db, {
        id: 'history-opcua',
        south_type: 'opcua',
        south_settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0, maxInstantPerItem: false },
          sharedConnection: false,
          url: 'opc.tcp://localhost',
          keepSessionAlive: false,
          readTimeout: 15000,
          retryInterval: 1000,
          securityMode: 'none',
          authentication: { type: 'none' }
        })
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-opcua').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.flushMessageTimeout, 1000);
      assert.strictEqual(settings.maxNumberOfMessages, 1000);
    });
  });
});
