import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_3';

const NOW = '2024-01-01T00:00:00.000Z';

const OLD_ODBC_SETTINGS = {
  remoteAgent: true,
  agentUrl: 'http://ip-adress-or-host:2224',
  connectionTimeout: 15000,
  retryInterval: 10000,
  requestTimeout: 15000,
  connectionString: 'Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;',
  password: null
};

const OLD_ODBC_LOCAL_SETTINGS = {
  remoteAgent: false,
  connectionTimeout: 15000,
  retryInterval: 10000,
  requestTimeout: 15000,
  connectionString: 'Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;',
  password: null
};

describe('Entity migration v3.10.0_3', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_3');
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
  });

  it('runs end-to-end on a realistic pre-3.10.0_3 schema', async () => {
    await up(db); // must not throw
  });

  it('drops remoteAgent/agentUrl/retryInterval/requestTimeout from an odbc south connector, preserving other fields', async () => {
    await db('south_connectors').insert({
      id: 'odbc1',
      name: 'ODBC 1',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'odbc1').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_SETTINGS.connectionString,
      password: null
    });
  });

  it('drops the same fields whether remoteAgent was true or false', async () => {
    await db('south_connectors').insert({
      id: 'odbc-local',
      name: 'ODBC local',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_LOCAL_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'odbc-local').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_LOCAL_SETTINGS.connectionString,
      password: null
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

  it('drops the same fields from a history query with an odbc south, preserving other fields', async () => {
    await db('history_queries').insert({
      id: 'hq-odbc',
      name: 'HQ ODBC',
      start_time: NOW,
      end_time: NOW,
      south_type: 'odbc',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_ODBC_SETTINGS),
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

    const row = await db('history_queries').where('id', 'hq-odbc').first();
    const settings = JSON.parse(row.south_settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_SETTINGS.connectionString,
      password: null
    });
  });

  it('does not touch south_settings of history queries with a different south type', async () => {
    const oldSettings = { host: 'h', port: 1, database: 'd' };
    await db('history_queries').insert({
      id: 'hq-postgres',
      name: 'HQ Postgres',
      start_time: NOW,
      end_time: NOW,
      south_type: 'postgresql',
      north_type: 'file-writer',
      south_settings: JSON.stringify(oldSettings),
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

    const row = await db('history_queries').where('id', 'hq-postgres').first();
    assert.deepStrictEqual(JSON.parse(row.south_settings), oldSettings);
  });

  it('down is a no-op', async () => {
    await db('south_connectors').insert({
      id: 'odbc2',
      name: 'ODBC 2',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_SETTINGS)
    });
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'odbc2').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.remoteAgent, undefined, 'down does not revert the up() migration');
  });
});
