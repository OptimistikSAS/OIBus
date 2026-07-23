import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.6.8';

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

/** Build the real schema as it exists just before v3.6.8 by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.6.8');
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

// history_queries at this point already has the caching_* columns renamed by v3.6.0
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

describe('Entity migration v3.6.8', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v368-'));
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

  it('runs end-to-end on a realistic pre-3.6.8 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('updateSouthSQLItemSettings', () => {
    it('converts every old date-time type for an mssql south item, including the passthrough default case', async () => {
      await insertSouthConnector(db, { id: 'south-mssql', type: 'mssql' });
      await insertSouthItem(db, {
        id: 'item-mssql',
        connector_id: 'south-mssql',
        settings: JSON.stringify({
          query: 'select *',
          dateTimeFields: [
            { fieldName: 'a', type: 'Date' },
            { fieldName: 'b', type: 'DateTime' },
            { fieldName: 'c', type: 'DateTime2' },
            { fieldName: 'd', type: 'DateTimeOffset' },
            { fieldName: 'e', type: 'SmallDateTime' },
            { fieldName: 'f', type: 'iso-string' }
          ]
        })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.query, 'select *', 'existing settings preserved');
      assert.deepStrictEqual(
        settings.dateTimeFields.map((f: { type: string }) => f.type),
        ['date', 'date-time', 'date-time-2', 'date-time-offset', 'small-date-time', 'iso-string']
      );
    });

    it("passes through 'timestamp', 'timestamptz' and bare 'string' old types unchanged", async () => {
      await insertSouthConnector(db, { id: 'south-mssql', type: 'mssql' });
      await insertSouthItem(db, {
        id: 'item-mssql-passthrough',
        connector_id: 'south-mssql',
        settings: JSON.stringify({
          query: 'select *',
          dateTimeFields: [
            { fieldName: 'a', type: 'timestamp' },
            { fieldName: 'b', type: 'timestamptz' },
            { fieldName: 'c', type: 'string' }
          ]
        })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-mssql-passthrough').first();
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(
        settings.dateTimeFields.map((f: { type: string }) => f.type),
        ['timestamp', 'timestamptz', 'string']
      );
    });

    it('does not touch items belonging to a non-mssql connector', async () => {
      await insertSouthConnector(db, { id: 'south-mqtt', type: 'mqtt' });
      await insertSouthItem(db, {
        id: 'item-mqtt',
        connector_id: 'south-mqtt',
        settings: JSON.stringify({ topic: 'topic' })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-mqtt').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.topic, 'topic', 'non-mssql south item untouched');
    });
  });

  describe('updateHistorySQLItemSettings', () => {
    it('converts every old date-time type for an mssql history item', async () => {
      await insertHistoryQuery(db, { id: 'history-mssql', south_type: 'mssql' });
      await insertHistoryItem(db, {
        id: 'history-item-mssql',
        history_id: 'history-mssql',
        settings: JSON.stringify({
          query: 'select *',
          dateTimeFields: [
            { fieldName: 'a', type: 'Date' },
            { fieldName: 'b', type: 'DateTime' },
            { fieldName: 'c', type: 'DateTime2' },
            { fieldName: 'd', type: 'DateTimeOffset' },
            { fieldName: 'e', type: 'SmallDateTime' },
            { fieldName: 'f', type: 'unix-epoch' }
          ]
        })
      });

      await up(db);

      const row = await db('history_items').where('id', 'history-item-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(
        settings.dateTimeFields.map((f: { type: string }) => f.type),
        ['date', 'date-time', 'date-time-2', 'date-time-offset', 'small-date-time', 'unix-epoch']
      );
    });

    it('does not touch history items belonging to a non-mssql history query', async () => {
      await insertHistoryQuery(db, { id: 'history-postgres', south_type: 'postgresql', name: 'History postgres' });
      await insertHistoryItem(db, {
        id: 'history-item-postgres',
        history_id: 'history-postgres',
        settings: JSON.stringify({ query: 'select 1' })
      });

      await up(db);

      const row = await db('history_items').where('id', 'history-item-postgres').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.query, 'select 1', 'non-mssql history item untouched');
    });
  });
});
