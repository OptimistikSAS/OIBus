/**
 * Entity migration upgrade scenario tests.
 *
 * Pre-populates a database in the v3.0 schema format with a wide variety of connector types,
 * items, and history queries, then runs all migrations in sequence. This exercises data-
 * transformation loops and switch-case branches that are never triggered when migrations run
 * on an empty database (the standard test setup).
 *
 * Key rule: this spec lives in src/migration/ — NOT inside entity-migrations/**
 * because knex scans those subdirectories for migration files.
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import knex from 'knex';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { migrateEntities } from './migration-service';

function getMigrationDirsLocal(base: string): Array<string> {
  const entries = readdirSync(base, { withFileTypes: true });
  const subDirs = entries.filter(e => e.isDirectory()).map(e => path.join(base, e.name));
  if (subDirs.length === 0) return [base];
  return subDirs.flatMap(d => getMigrationDirsLocal(d));
}

const TMP_DB = path.join(os.tmpdir(), `entity-migration-upgrade-${process.pid}.db`);
const ENTITY_MIGRATIONS_BASE = path.resolve('src/migration/entity-migrations');
const ENTITY_V3_0_DIR = path.join(ENTITY_MIGRATIONS_BASE, '3', '3.0');

// IDs
const SCAN_ID = 'scan-every-10s';
const ENGINE_ID = 'engine-1';
const NORTH_OIANALYTICS = 'north-oianalytics-1';
const NORTH_AZURE_ACCESS_KEY = 'north-azure-accesskey';
const NORTH_AZURE_SAS = 'north-azure-sas';
const NORTH_AZURE_AAD = 'north-azure-aad';
const NORTH_AZURE_EXT = 'north-azure-external';
const NORTH_MODBUS = 'north-modbus-1';
const NORTH_OIBUS = 'north-oibus-1';
const NORTH_MQTT = 'north-mqtt-1';
const NORTH_OPCUA = 'north-opcua-1';

describe('Entity migration upgrade scenario (pre-populated DB)', () => {
  let db: ReturnType<typeof knex>;

  before(async () => {
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);

    // 1. Run only v3.0 to create the initial tables.
    db = knex({
      client: 'better-sqlite3',
      connection: { filename: TMP_DB },
      useNullAsDefault: true,
      migrations: { tableName: 'migrations' }
    });
    await db.migrate.latest({ directory: ENTITY_V3_0_DIR });

    // 2. Insert comprehensive test data covering all south/north types that
    //    the subsequent migrations need to process.

    await db('engines').insert({
      id: ENGINE_ID,
      name: 'OIBus',
      port: 2223,
      log_console_level: 'silent',
      log_file_level: 'silent',
      log_file_max_file_size: 50,
      log_file_number_of_files: 5,
      log_database_level: 'silent',
      log_database_max_number_of_logs: 100_000,
      log_loki_level: 'silent',
      log_loki_interval: 60
    });
    // User with login='admin' is needed by v3.8.0's addCreatedByAndUpdatedBy to populate created_by/updated_by
    await db('users').insert({
      id: 'user-admin',
      login: 'admin',
      password: '$argon2id$hashed',
      first_name: 'Admin',
      last_name: 'User',
      language: 'en',
      timezone: 'Europe/Paris'
    });
    await db('scan_modes').insert({ id: SCAN_ID, name: 'Every 10s', cron: '*/10 * * * * *' });

    // ── North connectors ──────────────────────────────────────────────────────

    const northBase = {
      enabled: 1,
      caching_scan_mode_id: SCAN_ID,
      caching_group_count: 1000,
      caching_retry_interval: 5_000,
      caching_retry_count: 3,
      caching_max_send_count: 10_000,
      caching_send_file_immediately: 1,
      caching_max_size: 0,
      archive_enabled: 0,
      archive_retention_duration: 0
    };
    await db('north_connectors').insert([
      {
        id: NORTH_OIANALYTICS,
        name: 'OIAnalytics North',
        type: 'oianalytics',
        settings: JSON.stringify({ host: 'https://example.com', apiKey: '', useProxy: false }),
        ...northBase
      },
      // Azure Blob with all 4 authentication methods (covers toNewAzureBlobAuthentication cases)
      {
        id: NORTH_AZURE_ACCESS_KEY,
        name: 'Azure AccessKey',
        type: 'azure-blob',
        settings: JSON.stringify({ account: 'acc', container: 'c', authentication: 'accessKey', sasToken: '', path: '' }),
        ...northBase
      },
      {
        id: NORTH_AZURE_SAS,
        name: 'Azure SasToken',
        type: 'azure-blob',
        settings: JSON.stringify({ account: 'acc', container: 'c', authentication: 'sasToken', sasToken: 'tok', path: '' }),
        ...northBase
      },
      {
        id: NORTH_AZURE_AAD,
        name: 'Azure AAD',
        type: 'azure-blob',
        settings: JSON.stringify({ account: 'acc', container: 'c', authentication: 'aad', sasToken: '', path: '' }),
        ...northBase
      },
      {
        id: NORTH_AZURE_EXT,
        name: 'Azure External',
        type: 'azure-blob',
        settings: JSON.stringify({ account: 'acc', container: 'c', authentication: 'external', sasToken: '', path: '' }),
        ...northBase
      },
      {
        id: NORTH_MODBUS,
        name: 'Modbus North',
        type: 'modbus',
        settings: JSON.stringify({ host: 'localhost', port: 502, retryInterval: 10_000 }),
        ...northBase
      },
      {
        id: NORTH_OIBUS,
        name: 'OIBus North',
        type: 'oibus',
        settings: JSON.stringify({ host: 'http://localhost:2223', apiKey: '' }),
        ...northBase
      },
      {
        id: NORTH_MQTT,
        name: 'MQTT North',
        type: 'mqtt',
        settings: JSON.stringify({ url: 'mqtt://localhost:1883', qos: 1, authentication: { type: 'none' } }),
        ...northBase
      },
      {
        id: NORTH_OPCUA,
        name: 'OPC UA North',
        type: 'opcua',
        settings: JSON.stringify({
          url: 'opc.tcp://localhost:4840',
          securityMode: 'none',
          securityPolicy: 'none',
          authentication: { type: 'none' }
        }),
        ...northBase
      }
    ]);

    // ── South connectors ──────────────────────────────────────────────────────

    const southBase = {
      enabled: 1,
      history_max_instant_per_item: 1,
      history_max_read_interval: 3600,
      history_read_delay: 200
    };
    const S = (id: string, name: string, type: string, settings: object) => ({
      id,
      name,
      type,
      settings: JSON.stringify(settings),
      ...southBase
    });

    await db('south_connectors').insert([
      // OPC UA — use OLD uppercase security policy format so v3.5.0 conversion is exercised
      S('s-opcua-none', 'OPCUA None', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'none',
        securityPolicy: 'None', // old uppercase → v3.5.0 converts to 'none'
        keepSessionAlive: false
      }),
      S('s-opcua-basic128', 'OPCUA Basic128', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic128', // covers Basic128 case
        keepSessionAlive: false
      }),
      S('s-opcua-basic192', 'OPCUA Basic192', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic192', // covers Basic192 case
        keepSessionAlive: false
      }),
      S('s-opcua-basic256', 'OPCUA Basic256', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic256', // obsolete → basic128
        keepSessionAlive: false
      }),
      S('s-opcua-basic128rsa15', 'OPCUA Basic128Rsa15', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic128Rsa15', // obsolete → basic128
        keepSessionAlive: false
      }),
      S('s-opcua-basic192rsa15', 'OPCUA Basic192Rsa15', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic192Rsa15',
        keepSessionAlive: false
      }),
      S('s-opcua-basic256rsa15', 'OPCUA Basic256Rsa15', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign',
        securityPolicy: 'Basic256Rsa15',
        keepSessionAlive: false
      }),
      S('s-opcua-sha256', 'OPCUA SHA256', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'Basic256Sha256',
        keepSessionAlive: false
      }),
      S('s-opcua-aes128', 'OPCUA AES128', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'Aes128_Sha256_RsaOaep',
        keepSessionAlive: false
      }),
      S('s-opcua-pubsub128', 'OPCUA PubSub128', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'PubSub_Aes128_CTR',
        keepSessionAlive: false
      }),
      S('s-opcua-pubsub256', 'OPCUA PubSub256', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'PubSub_Aes256_CTR',
        keepSessionAlive: false
      }),
      // Modbus — Big Endian + Modbus offset (one connector)
      S('s-modbus-big', 'Modbus Big Endian', 'modbus', {
        host: 'localhost',
        port: 502,
        retryInterval: 10_000,
        endianness: 'Big Endian',
        addressOffset: 'Modbus'
      }),
      // Modbus — Little Endian + JBus offset (covers toNewModbusEndianness/AddressOffset cases)
      S('s-modbus-little', 'Modbus Little Endian', 'modbus', {
        host: 'localhost',
        port: 503,
        retryInterval: 10_000,
        endianness: 'Little Endian',
        addressOffset: 'JBus'
      }),
      // ADS — Text variant (covers toNewADSAsText 'Text' case)
      S('s-ads-text', 'ADS Text', 'ads', {
        netId: '192.168.1.1.1.1',
        port: 851,
        retryInterval: 10_000,
        enumAsText: 'Text',
        boolAsText: 'Text'
      }),
      // ADS — Integer variant (covers toNewADSAsText 'Integer' case)
      S('s-ads-int', 'ADS Integer', 'ads', {
        netId: '192.168.1.1.1.2',
        port: 851,
        retryInterval: 10_000,
        enumAsText: 'Integer',
        boolAsText: 'Integer'
      }),
      // Oracle
      S('s-oracle', 'Oracle South', 'oracle', {
        host: 'localhost',
        port: 1521,
        database: 'ORCL',
        username: 'user',
        password: ''
      }),
      // MSSQL
      S('s-mssql', 'MSSQL South', 'mssql', {
        host: 'localhost',
        port: 1433,
        database: 'mydb',
        username: 'sa',
        password: ''
      }),
      // MySQL
      S('s-mysql', 'MySQL South', 'mysql', {
        host: 'localhost',
        port: 3306,
        database: 'mydb',
        username: 'root',
        password: ''
      }),
      // ODBC
      S('s-odbc', 'ODBC South', 'odbc', {
        connectionString: 'DSN=mydsn',
        agentUrl: 'http://localhost:2224',
        retryInterval: 10_000
      }),
      // OIAnalytics south (deleted by v3.5.0)
      S('s-oianalytics', 'OIAnalytics South', 'oianalytics', {
        host: 'https://example.com',
        apiKey: '',
        useProxy: false
      }),
      // OPC-HDA (renamed to 'opc' by v3.5.0)
      S('s-opc-hda', 'OPC HDA', 'opc-hda', {
        host: 'localhost',
        serverName: 'OPC.HDA.1',
        retryInterval: 10_000
      }),
      // OSIsoft PI
      S('s-osisoft', 'OSIsoft PI', 'osisoft-pi', {
        host: 'localhost',
        serverName: 'server',
        piWebApiUrl: 'http://localhost',
        authentication: { type: 'none' }
      }),
      // PostgreSQL
      S('s-postgresql', 'PostgreSQL South', 'postgresql', {
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        username: 'user',
        password: ''
      }),
      // OleDB
      S('s-oledb', 'OleDB South', 'oledb', {
        agentUrl: 'http://localhost:2224',
        connectionTimeout: 15_000,
        retryInterval: 10_000,
        requestTimeout: 15_000,
        connectionString: 'Provider=MSOLEDBSQL;'
      }),
      // MQTT
      S('s-mqtt', 'MQTT South', 'mqtt', {
        url: 'mqtt://localhost:1883',
        qos: 1,
        persistent: false,
        authentication: { type: 'none' },
        reconnectPeriod: 5_000,
        connectTimeout: 30_000
      })
    ]);

    // ── South items ───────────────────────────────────────────────────────────

    await db('south_items').insert([
      // OPC UA DA item
      {
        id: 'item-opcua-da',
        connector_id: 's-opcua-none',
        scan_mode_id: SCAN_ID,
        name: 'OPC UA DA item',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=DA',
          mode: 'DA',
          timestampOrigin: 'oibus',
          haMode: null
        })
      },
      // OPC UA HA item
      {
        id: 'item-opcua-ha',
        connector_id: 's-opcua-none',
        scan_mode_id: SCAN_ID,
        name: 'OPC UA HA item',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=HA',
          mode: 'HA',
          timestampOrigin: 'oibus',
          haMode: { aggregate: 'raw', resampling: 'none' }
        })
      },
      // Modbus item (for v3.3.7 migration)
      {
        id: 'item-modbus',
        connector_id: 's-modbus-big',
        scan_mode_id: SCAN_ID,
        name: 'Modbus item',
        enabled: 1,
        settings: JSON.stringify({
          address: '0x0001',
          modbusType: 'coil',
          multiplier: 1,
          offset: 0,
          data: { rawValue: null, type: 'coil' }
        })
      },
      // MSSQL item (for v3.6.8 / v3.7.1 dateTime migration)
      {
        id: 'item-mssql',
        connector_id: 's-mssql',
        scan_mode_id: SCAN_ID,
        name: 'MSSQL item',
        enabled: 1,
        settings: JSON.stringify({
          query: 'SELECT * FROM t WHERE ts > @StartTime',
          dateTimeFields: [
            { fieldName: 'ts', type: 'DateTime', useAsReference: true, timezone: 'UTC', format: null },
            { fieldName: 'd', type: 'Date', useAsReference: false, timezone: null, format: null },
            { fieldName: 'sdt', type: 'SmallDateTime', useAsReference: false, timezone: null, format: null },
            { fieldName: 'dt2', type: 'DateTime2', useAsReference: false, timezone: null, format: null },
            { fieldName: 'dto', type: 'DateTimeOffset', useAsReference: false, timezone: null, format: null }
          ],
          serialization: { type: 'csv', filename: 'out.csv', delimiter: 'COMMA', compression: false, outputTimestampFormat: 'yyyy-MM-dd', outputTimezone: 'UTC' }
        })
      }
    ]);

    // ── Subscriptions ─────────────────────────────────────────────────────────

    await db('subscription').insert([
      { north_connector_id: NORTH_OIANALYTICS, south_connector_id: 's-opcua-none' },
      { north_connector_id: NORTH_OIANALYTICS, south_connector_id: 's-modbus-big' }
    ]);

    // ── History queries — one per south_type that v3.5.0 processes ────────────

    const histBase = {
      description: '',
      enabled: 0,
      start_time: '2024-01-01T00:00:00.000Z',
      end_time: '2024-12-31T23:59:59.999Z',
      north_type: 'oianalytics',
      north_settings: JSON.stringify({ host: 'https://example.com', apiKey: '', useProxy: false }),
      history_max_instant_per_item: 1,
      history_max_read_interval: 3600,
      history_read_delay: 200,
      caching_scan_mode_id: SCAN_ID,
      caching_group_count: 1000,
      caching_retry_interval: 5_000,
      caching_retry_count: 3,
      caching_max_send_count: 10_000,
      caching_send_file_immediately: 1,
      caching_max_size: 0,
      archive_enabled: 0,
      archive_retention_duration: 0
    };
    const H = (id: string, name: string, southType: string, southSettings: object) => ({
      id,
      name,
      south_type: southType,
      south_settings: JSON.stringify(southSettings),
      ...histBase
    });

    await db('history_queries').insert([
      H('hq-mssql', 'MSSQL History', 'mssql', { host: 'localhost', port: 1433, database: 'db', username: 'sa', password: '' }),
      H('hq-opc-hda', 'OPC-HDA History', 'opc-hda', { host: 'localhost', serverName: 'OPC.HDA.1', retryInterval: 10_000 }),
      H('hq-opcua', 'OPC UA History', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        retryInterval: 10_000,
        authentication: { type: 'none' },
        securityMode: 'none',
        securityPolicy: 'None',
        keepSessionAlive: false
      }),
      H('hq-osisoft', 'OSIsoft History', 'osisoft-pi', {
        host: 'localhost',
        serverName: 'server',
        piWebApiUrl: 'http://localhost',
        authentication: { type: 'none' }
      }),
      H('hq-mysql', 'MySQL History', 'mysql', { host: 'localhost', port: 3306, database: 'mydb', username: 'root', password: '' }),
      H('hq-odbc', 'ODBC History', 'odbc', { connectionString: 'DSN=mydsn', agentUrl: 'http://localhost:2224', retryInterval: 10_000 }),
      H('hq-oianalytics', 'OIAnalytics History', 'oianalytics', { host: 'https://example.com', apiKey: '', useProxy: false }),
      H('hq-oledb', 'OleDB History', 'oledb', {
        agentUrl: 'http://localhost:2224',
        connectionTimeout: 15_000,
        retryInterval: 10_000,
        requestTimeout: 15_000,
        connectionString: 'Provider=MSOLEDBSQL;'
      }),
      H('hq-oracle', 'Oracle History', 'oracle', { host: 'localhost', port: 1521, database: 'ORCL', username: 'user', password: '' }),
      H('hq-postgresql', 'PostgreSQL History', 'postgresql', { host: 'localhost', port: 5432, database: 'mydb', username: 'user', password: '' })
    ]);

    // ── History items ─────────────────────────────────────────────────────────

    await db('history_items').insert([
      {
        id: 'hi-mssql-1',
        history_id: 'hq-mssql',
        name: 'MSSQL Hist Item',
        enabled: 1,
        settings: JSON.stringify({
          query: 'SELECT * FROM t',
          dateTimeFields: [{ fieldName: 'ts', type: 'DateTime', useAsReference: true, timezone: 'UTC', format: null }],
          serialization: { type: 'csv', filename: 'out.csv', delimiter: 'COMMA', compression: false, outputTimestampFormat: 'yyyy-MM-dd', outputTimezone: 'UTC' }
        })
      },
      // OPC UA history items — needed by v3.7.4 (inner loop for history OPC UA items)
      {
        id: 'hi-opcua-da',
        history_id: 'hq-opcua',
        name: 'OPC UA DA Hist',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=DA',
          mode: 'da',
          timestampOrigin: 'oibus',
          haMode: null
        })
      },
      {
        id: 'hi-opcua-ha',
        history_id: 'hq-opcua',
        name: 'OPC UA HA Hist',
        enabled: 1,
        settings: JSON.stringify({
          nodeId: 'ns=1;s=HA',
          mode: 'ha',
          timestampOrigin: 'oibus',
          haMode: { aggregate: 'raw', resampling: 'none' }
        })
      }
    ]);

    // 3. Destroy our setup knex, then call migrateEntities which creates its own
    //    knex instance and skips v3.0 (already recorded in migrations table).
    await db.destroy();
    await migrateEntities(TMP_DB);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(TMP_DB, { force: true });
  });

  it('south connectors survive all migrations and opc-hda was renamed to opc', async () => {
    const finalDb = knex({ client: 'better-sqlite3', connection: { filename: TMP_DB }, useNullAsDefault: true });
    try {
      const connectors = await finalDb('south_connectors').select('id', 'type');
      assert.ok(connectors.length > 0, 'At least one south connector must survive');
      // opc-hda should have been renamed to 'opc' by v3.5.0
      const opc = connectors.find((c: { type: string }) => c.type === 'opc');
      assert.ok(opc, 'opc-hda should have been renamed to opc');
    } finally {
      await finalDb.destroy();
    }
  });

  it('north connectors survive and oibus north was deleted', async () => {
    const finalDb = knex({ client: 'better-sqlite3', connection: { filename: TMP_DB }, useNullAsDefault: true });
    try {
      const connectors = await finalDb('north_connectors').select('id', 'type');
      assert.ok(!connectors.find((c: { type: string }) => c.type === 'oibus'), 'oibus north should be deleted');
      assert.ok(connectors.length > 0);
    } finally {
      await finalDb.destroy();
    }
  });

  it('all entity migrations were applied', async () => {
    const finalDb = knex({ client: 'better-sqlite3', connection: { filename: TMP_DB }, useNullAsDefault: true });
    try {
      const migrations = await finalDb('migrations').select('name');
      assert.ok(migrations.length > 10);
    } finally {
      await finalDb.destroy();
    }
  });
});
