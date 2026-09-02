import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_4';

const NOW = '2024-01-01T00:00:00.000Z';

const OLD_OPC_SETTINGS = {
  agentUrl: 'http://ip-adress-or-host:2224',
  retryInterval: 10000,
  host: 'localhost',
  serverName: 'Matrikon.OPC.Simulation',
  mode: 'hda'
};

describe('Entity migration v3.10.0_4', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_4');
  });

  it('runs end-to-end on a realistic pre-3.10.0_3 schema', async () => {
    await up(db); // must not throw
  });

  it('drops agentUrl from an OPC south connector, preserving host/serverName/mode/retryInterval', async () => {
    await db('south_connectors').insert({
      id: 'opc1',
      name: 'OPC 1',
      type: 'opc',
      enabled: true,
      settings: JSON.stringify(OLD_OPC_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'opc1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), {
      retryInterval: 10000,
      host: 'localhost',
      serverName: 'Matrikon.OPC.Simulation',
      mode: 'hda'
    });
  });

  it('drops agentUrl from a history query with an OPC south', async () => {
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('history_queries').insert({
      id: 'hq-opc',
      name: 'HQ OPC',
      start_time: NOW,
      end_time: NOW,
      south_type: 'opc',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_OPC_SETTINGS),
      north_settings: JSON.stringify({}),
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    });

    await up(db);

    const row = await db('history_queries').where('id', 'hq-opc').first();
    assert.deepStrictEqual(JSON.parse(row.south_settings), {
      retryInterval: 10000,
      host: 'localhost',
      serverName: 'Matrikon.OPC.Simulation',
      mode: 'hda'
    });
  });

  it('does not touch settings of south connectors of other types', async () => {
    const oldSettings = { host: 'h', port: 1, database: 'd', connectionTimeout: 1000 };
    await db('south_connectors').insert({
      id: 'mysql1',
      name: 'MySQL 1',
      type: 'mysql',
      enabled: true,
      settings: JSON.stringify(oldSettings)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'mysql1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), oldSettings);
  });

  it('down is a no-op', async () => {
    await db('south_connectors').insert({
      id: 'opc2',
      name: 'OPC 2',
      type: 'opc',
      enabled: true,
      settings: JSON.stringify(OLD_OPC_SETTINGS)
    });
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'opc2').first();
    assert.strictEqual(JSON.parse(row.settings).agentUrl, undefined, 'down does not revert the up() migration');
  });
});
