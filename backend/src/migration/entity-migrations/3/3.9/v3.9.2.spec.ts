import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.9.2';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.9.2', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.9.2.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  async function insertSouthConnector(id: string, type: string) {
    await db('south_connectors').insert({
      id,
      name: `Test ${id}`,
      type,
      description: '',
      enabled: 1,
      settings: '{}',
      created_by: 'admin',
      updated_by: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  async function insertSouthItem(id: string, connectorId: string, settings: object) {
    await db('south_items').insert({
      id,
      connector_id: connectorId,
      name: `Item ${id}`,
      enabled: 1,
      settings: JSON.stringify(settings),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  async function insertHistoryQuery(id: string, southType: string) {
    await db('scan_modes')
      .insert({
        id: 'scan-mode-1',
        name: 'Every 10s',
        description: '',
        cron: '*/10 * * * * *',
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      })
      .onConflict('id')
      .ignore();
    await db('history_queries').insert({
      id,
      status: 'PENDING',
      name: `Test ${id}`,
      description: '',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-02T00:00:00Z',
      south_type: southType,
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}',
      caching_trigger_schedule: 'scan-mode-1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10000,
      caching_error_retry_interval: 1000,
      caching_error_retry_count: 3,
      caching_archive_enabled: 0,
      caching_archive_retention_duration: 0,
      created_by: 'admin',
      updated_by: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  async function insertHistoryItem(id: string, historyId: string, settings: object) {
    await db('history_items').insert({
      id,
      history_id: historyId,
      name: `Item ${id}`,
      enabled: 1,
      settings: JSON.stringify(settings),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  describe('up', () => {
    it('strips an empty timestampOrigin from an opcua south item while preserving the rest of its settings', async () => {
      await insertSouthConnector('south-1', 'opcua');
      await insertSouthItem('item-1', 'south-1', {
        nodeId: 'ns=4;s=test',
        mode: 'ha',
        haMode: { aggregate: 'raw' },
        timestampOrigin: ''
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual('timestampOrigin' in settings, false);
      assert.strictEqual(settings.nodeId, 'ns=4;s=test');
      assert.deepStrictEqual(settings.haMode, { aggregate: 'raw' });
    });

    it('leaves a valid timestampOrigin value untouched', async () => {
      await insertSouthConnector('south-1', 'opcua');
      await insertSouthItem('item-1', 'south-1', { nodeId: 'ns=4;s=test', mode: 'da', timestampOrigin: 'server' });

      await up(db);

      const row = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(JSON.parse(row.settings).timestampOrigin, 'server');
    });

    it('does not fail on items that never had timestampOrigin set', async () => {
      await insertSouthConnector('south-1', 'opcua');
      await insertSouthItem('item-1', 'south-1', { nodeId: 'ns=4;s=test', mode: 'ha', haMode: { aggregate: 'raw' } });

      await up(db);

      const row = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual('timestampOrigin' in JSON.parse(row.settings), false);
    });

    it('does not touch items belonging to a non-opcua south connector', async () => {
      await insertSouthConnector('south-1', 'folder-scanner');
      await insertSouthItem('item-1', 'south-1', { regex: '.*', timestampOrigin: '' });

      await up(db);

      const row = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(JSON.parse(row.settings).timestampOrigin, '');
    });

    it('strips an empty timestampOrigin from an opcua history query item', async () => {
      await insertHistoryQuery('history-1', 'opcua');
      await insertHistoryItem('item-1', 'history-1', {
        nodeId: 'ns=4;s=test',
        mode: 'ha',
        haMode: { aggregate: 'raw' },
        timestampOrigin: ''
      });

      await up(db);

      const row = await db('history_items').where('id', 'item-1').first();
      assert.strictEqual('timestampOrigin' in JSON.parse(row.settings), false);
    });

    it('does not touch history items belonging to a non-opcua history query', async () => {
      await insertHistoryQuery('history-1', 'mssql');
      await insertHistoryItem('item-1', 'history-1', { query: 'SELECT 1', timestampOrigin: '' });

      await up(db);

      const row = await db('history_items').where('id', 'item-1').first();
      assert.strictEqual(JSON.parse(row.settings).timestampOrigin, '');
    });
  });

  describe('down', () => {
    it('is a no-op that resolves without throwing', async () => {
      await assert.doesNotReject(down(db));
    });
  });
});
