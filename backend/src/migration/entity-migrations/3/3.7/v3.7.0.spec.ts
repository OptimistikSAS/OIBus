import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.7.0';

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

/** Build the real schema as it exists just before v3.7.0 by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.7.0');
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
    type: 'postgresql',
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

// history_queries at this point already has the caching_* columns renamed by v3.6.0
async function insertHistoryQuery(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'history-1',
    name: 'History 1',
    description: '',
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: 'postgresql',
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

describe('Entity migration v3.7.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v370-'));
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

  it('runs end-to-end on a realistic pre-3.7.0 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('transformers tables', () => {
    it('creates the transformers table with the expected columns', async () => {
      await up(db);
      const exists = await db.schema.hasTable('transformers');
      assert.ok(exists, 'transformers table created');
      const cols = await columnNames(db, 'transformers');
      for (const col of [
        'id',
        'type',
        'input_type',
        'output_type',
        'function_name',
        'name',
        'description',
        'custom_manifest',
        'custom_code'
      ]) {
        assert.ok(cols.includes(col), `transformers.${col} present`);
      }
    });

    it('creates the north_transformers table with the expected columns', async () => {
      await up(db);
      const exists = await db.schema.hasTable('north_transformers');
      assert.ok(exists, 'north_transformers table created');
      const cols = await columnNames(db, 'north_transformers');
      for (const col of ['north_id', 'transformer_id', 'options', 'input_type']) {
        assert.ok(cols.includes(col), `north_transformers.${col} present`);
      }
    });

    it('creates the history_query_transformers table with the expected columns', async () => {
      await up(db);
      const exists = await db.schema.hasTable('history_query_transformers');
      assert.ok(exists, 'history_query_transformers table created');
      const cols = await columnNames(db, 'history_query_transformers');
      for (const col of ['history_id', 'transformer_id', 'options', 'input_type']) {
        assert.ok(cols.includes(col), `history_query_transformers.${col} present`);
      }
    });
  });

  describe('registrations command_setpoint column', () => {
    it('adds the column and sets it to true for existing rows', async () => {
      await db('registrations').insert({
        id: 'registration-1',
        host: 'https://example.com',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });

      await up(db);

      const cols = await columnNames(db, 'registrations');
      assert.ok(cols.includes('command_setpoint'));
      const row = await db('registrations').where('id', 'registration-1').first();
      assert.strictEqual(row.command_setpoint, 1);
    });
  });

  describe('updatePostgresqlSettings', () => {
    it('adds sslMode: false to a postgresql south connector', async () => {
      await insertSouthConnector(db, {
        id: 'south-postgres',
        type: 'postgresql',
        settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 },
          host: 'localhost',
          port: 5432,
          database: 'db',
          connectionTimeout: 1000,
          requestTimeout: 1000,
          username: 'user',
          password: 'pass'
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-postgres').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.host, 'localhost', 'existing settings preserved');
      assert.strictEqual(settings.sslMode, false);
    });

    it('adds sslMode: false to a postgresql history query south_settings', async () => {
      await insertHistoryQuery(db, {
        id: 'history-postgres',
        south_type: 'postgresql',
        south_settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 },
          host: 'localhost',
          port: 5432,
          database: 'db',
          connectionTimeout: 1000,
          requestTimeout: 1000,
          username: 'user',
          password: 'pass'
        })
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-postgres').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.sslMode, false);
    });
  });

  describe('updateOleDBSettings', () => {
    it('adds password: null to an oledb south connector', async () => {
      await insertSouthConnector(db, {
        id: 'south-oledb',
        type: 'oledb',
        settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 },
          agentUrl: 'http://localhost',
          connectionTimeout: 1000,
          retryInterval: 1000,
          requestTimeout: 1000,
          connectionString: 'connection-string'
        })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-oledb').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.connectionString, 'connection-string', 'existing settings preserved');
      assert.strictEqual(settings.password, null);
    });

    it('adds password: null to an oledb history query south_settings', async () => {
      await insertHistoryQuery(db, {
        id: 'history-oledb',
        south_type: 'oledb',
        south_settings: JSON.stringify({
          throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 },
          agentUrl: 'http://localhost',
          connectionTimeout: 1000,
          retryInterval: 1000,
          requestTimeout: 1000,
          connectionString: 'connection-string'
        })
      });

      await up(db);

      const row = await db('history_queries').where('id', 'history-oledb').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.password, null);
    });

    it('does not touch settings of south connectors of other types', async () => {
      await insertSouthConnector(db, {
        id: 'south-mssql',
        type: 'mssql',
        settings: JSON.stringify({ host: 'localhost' })
      });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.sslMode, undefined);
      assert.strictEqual(settings.password, undefined);
    });
  });
});
