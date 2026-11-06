import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_1';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

const CACHING = {
  caching_trigger_schedule: 'scan-mode-1',
  caching_trigger_number_of_elements: 1000,
  caching_trigger_number_of_files: 1,
  caching_throttling_run_min_delay: 200,
  caching_throttling_cache_max_size: 30,
  caching_throttling_max_number_of_elements: 10000,
  caching_error_retry_interval: 1000,
  caching_error_retry_count: 3,
  caching_error_retention_duration: 24,
  caching_archive_enabled: 0,
  caching_archive_retention_duration: 72
};
const AUDIT = {
  created_by: 'admin',
  updated_by: 'admin',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

describe('Entity migration v3.10.0_1', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_1.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert({ id: 'scan-mode-1', name: 'Every 10s', description: '', cron: '*/10 * * * * *', ...AUDIT });
    await db('north_connectors').insert({
      id: 'north-1',
      name: 'North',
      type: 'console',
      description: '',
      enabled: 1,
      settings: '{}',
      ...CACHING,
      ...AUDIT
    });
    await db('history_queries').insert({
      id: 'history-1',
      status: 'PENDING',
      name: 'History',
      description: '',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-02T00:00:00Z',
      south_type: 'folder-scanner',
      north_type: 'console',
      south_settings: '{}',
      north_settings: '{}',
      ...CACHING,
      ...AUDIT
    });
  });
  afterEach(() => harness.afterEach());

  it('gives the error and archive folders the max size of the cache', async () => {
    await up(db);

    for (const table of ['north_connectors', 'history_queries']) {
      const row = await db(table).first('caching_error_max_size', 'caching_archive_max_size');
      assert.deepStrictEqual({ ...row }, { caching_error_max_size: 30, caching_archive_max_size: 30 });
    }
  });

  it('removes the columns on down', async () => {
    await up(db);
    await down(db);

    for (const table of ['north_connectors', 'history_queries']) {
      assert.strictEqual(await db.schema.hasColumn(table, 'caching_error_max_size'), false);
      assert.strictEqual(await db.schema.hasColumn(table, 'caching_archive_max_size'), false);
    }
  });
});
