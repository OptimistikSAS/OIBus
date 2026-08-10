import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.1.0-initial-setup-fix';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertHistoryQuery(db: Knex, id: string, name: string, enabled: boolean) {
  await db('history_queries').insert({
    id,
    name,
    enabled,
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: 'mssql',
    north_type: 'oianalytics',
    south_settings: '{}',
    north_settings: '{}',
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

describe('Entity migration v3.1.0-initial-setup-fix', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.1.0-initial-setup-fix.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', cron: '*/10 * * * * *' });
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.1.0 schema', async () => {
    await up(db); // must not throw
  });

  it('adds a status column defaulting to PENDING', async () => {
    await up(db);
    const cols = await columnNames(db, 'history_queries');
    assert.ok(cols.includes('status'));
  });

  it('sets status to RUNNING for enabled history queries', async () => {
    await insertHistoryQuery(db, 'history-1', 'History A', true);

    await up(db);

    const row = await db('history_queries').where('id', 'history-1').first();
    assert.strictEqual(row.status, 'RUNNING');
  });

  it('leaves status as PENDING for disabled history queries', async () => {
    await insertHistoryQuery(db, 'history-2', 'History B', false);

    await up(db);

    const row = await db('history_queries').where('id', 'history-2').first();
    assert.strictEqual(row.status, 'PENDING');
  });

  it('preserves history_queries data across the table rebuild', async () => {
    await insertHistoryQuery(db, 'history-3', 'History C', true);

    await up(db);

    const row = await db('history_queries').where('id', 'history-3').first();
    assert.strictEqual(row.name, 'History C');
    assert.strictEqual(row.south_type, 'mssql');
    assert.strictEqual(row.north_type, 'oianalytics');
    assert.strictEqual(row.caching_scan_mode_id, 'scan-mode-1');
  });

  it('enforces a unique constraint on history_queries.name after rebuild', async () => {
    await up(db);
    // After the rebuild the `enabled` column is gone (replaced by `status`), so insert directly.
    const postRebuildRow = (id: string, name: string) => ({
      id,
      name,
      status: 'PENDING',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-02T00:00:00Z',
      south_type: 'mssql',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}',
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
    await db('history_queries').insert(postRebuildRow('history-4', 'Duplicate Name'));
    await assert.rejects(db('history_queries').insert(postRebuildRow('history-5', 'Duplicate Name')));
  });

  it('preserves history_items data and adds a foreign key + unique constraint on (history_id, name)', async () => {
    await insertHistoryQuery(db, 'history-6', 'History F', true);
    await db('history_items').insert({
      id: 'history-item-1',
      history_id: 'history-6',
      name: 'Item A',
      enabled: true,
      description: 'desc',
      settings: '{"key":"value"}'
    });

    await up(db);

    const item = await db('history_items').where('id', 'history-item-1').first();
    assert.strictEqual(item.history_id, 'history-6');
    assert.strictEqual(item.name, 'Item A');
    assert.strictEqual(item.settings, '{"key":"value"}');

    // unique constraint on (history_id, name) — inserting a duplicate pair must fail
    await assert.rejects(
      db('history_items').insert({
        id: 'history-item-2',
        history_id: 'history-6',
        name: 'Item A',
        enabled: true,
        settings: '{}'
      })
    );
  });

  it('down is a no-op', async () => {
    await up(db);
    await down(db);
    const cols = await columnNames(db, 'history_queries');
    assert.ok(cols.includes('status'), 'down does not revert the migration');
  });
});
