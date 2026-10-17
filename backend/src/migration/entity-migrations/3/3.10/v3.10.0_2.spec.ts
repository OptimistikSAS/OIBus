import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_2';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.10.0_2', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_2.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('south_connectors').insert([
      { id: 'opcua1', name: 'OPCUA', type: 'opcua', enabled: true, settings: '{}' },
      { id: 'opc1', name: 'OPC', type: 'opc', enabled: true, settings: '{}' },
      { id: 'mqtt1', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert([historyQuery('hq-opcua', 'opcua'), historyQuery('hq-opc', 'opc')]);
  });
  afterEach(() => harness.afterEach());

  async function settingsOf(table: string, id: string): Promise<unknown> {
    return JSON.parse((await db(table).where('id', id).first()).settings);
  }

  function historyQuery(id: string, southType: string) {
    return {
      id,
      name: id,
      start_time: '2026-01-01T00:00:00.000Z',
      end_time: '2026-01-02T00:00:00.000Z',
      south_type: southType,
      north_type: 'console',
      south_settings: '{}',
      north_settings: '{}',
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    };
  }

  function southItem(id: string, connectorId: string, settings: object) {
    return { id, connector_id: connectorId, scan_mode_id: 'sm1', name: id, enabled: true, settings: JSON.stringify(settings) };
  }

  function historyItem(id: string, historyId: string, settings: object) {
    return { id, history_id: historyId, name: id, enabled: true, settings: JSON.stringify(settings) };
  }

  it('should replace the raw resampling of OPC UA and OPC items with none', async () => {
    await db('south_items').insert([
      southItem('opcua-raw', 'opcua1', { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'average', resampling: 'raw' } }),
      southItem('opcua-1min', 'opcua1', { nodeId: 'ns=2', mode: 'ha', haMode: { aggregate: 'average', resampling: '1min' } }),
      southItem('opcua-da', 'opcua1', { nodeId: 'ns=3', mode: 'da', timestampOrigin: 'oibus' }),
      southItem('opc-raw', 'opc1', { nodeId: 'a', aggregate: 'average', resampling: 'raw' }),
      southItem('mqtt-raw', 'mqtt1', { topic: 't', resampling: 'raw' })
    ]);
    await db('history_items').insert([
      historyItem('hq-opcua-raw', 'hq-opcua', { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'count', resampling: 'raw' } }),
      historyItem('hq-opc-raw', 'hq-opc', { nodeId: 'a', aggregate: 'count', resampling: 'raw' }),
      historyItem('hq-opc-10s', 'hq-opc', { nodeId: 'b', aggregate: 'count', resampling: '10s' })
    ]);

    await up(db);

    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-raw'), {
      nodeId: 'ns=1',
      mode: 'ha',
      haMode: { aggregate: 'average', resampling: 'none' }
    });
    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-1min'), {
      nodeId: 'ns=2',
      mode: 'ha',
      haMode: { aggregate: 'average', resampling: '1min' }
    });
    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-da'), { nodeId: 'ns=3', mode: 'da', timestampOrigin: 'oibus' });
    assert.deepStrictEqual(await settingsOf('south_items', 'opc-raw'), { nodeId: 'a', aggregate: 'average', resampling: 'none' });
    assert.deepStrictEqual(await settingsOf('south_items', 'mqtt-raw'), { topic: 't', resampling: 'raw' });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opcua-raw'), {
      nodeId: 'ns=1',
      mode: 'ha',
      haMode: { aggregate: 'count', resampling: 'none' }
    });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opc-raw'), { nodeId: 'a', aggregate: 'count', resampling: 'none' });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opc-10s'), { nodeId: 'b', aggregate: 'count', resampling: '10s' });
  });

  it('should do nothing on down', async () => {
    await assert.doesNotReject(down(db));
  });
});
