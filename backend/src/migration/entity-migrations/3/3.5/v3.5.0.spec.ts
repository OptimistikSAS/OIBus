import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.5.0';

const TARGET_BASENAME = 'v3.5.0.ts';

/**
 * Collect every entity migration file (excluding specs) under the entity-migrations root,
 * sorted lexicographically by filename — the same order OIBus's migration runner uses.
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

/** Build the real schema as it exists just before this migration by running every prior migration in order. */
async function buildPriorSchema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < TARGET_BASENAME);
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertScanMode(db: Knex, id: string) {
  await db('scan_modes').insert({ id, name: `Scan ${id}`, description: '', cron: '*/10 * * * * *' });
}

async function insertEngine(db: Knex, id = 'engine-1') {
  await db('engines').insert({
    id,
    name: 'Test Engine',
    port: 2223,
    log_console_level: 'silent',
    log_file_level: 'silent',
    log_file_max_file_size: 50,
    log_file_number_of_files: 5,
    log_database_level: 'silent',
    log_database_max_number_of_logs: 100000,
    log_loki_level: 'silent',
    log_loki_interval: 60,
    log_oia_level: 'silent',
    log_oia_interval: 10,
    proxy_enabled: 0,
    proxy_port: 9000,
    oibus_version: '3.4.0',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthConnector(
  db: Knex,
  id: string,
  type: string,
  settings: unknown,
  overrides: Partial<{
    history_max_read_interval: number;
    history_read_delay: number;
    history_read_overlap: number;
    history_max_instant_per_item: number;
  }> = {}
) {
  await db('south_connectors').insert({
    id,
    name: `South ${id}`,
    type,
    description: '',
    enabled: 1,
    settings: JSON.stringify(settings),
    history_max_instant_per_item: overrides.history_max_instant_per_item ?? 0,
    history_max_read_interval: overrides.history_max_read_interval ?? 3600,
    history_read_delay: overrides.history_read_delay ?? 200,
    history_read_overlap: overrides.history_read_overlap ?? 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthItem(db: Knex, id: string, connectorId: string, scanModeId: string, settings: unknown, name?: string) {
  await db('south_items').insert({
    id,
    connector_id: connectorId,
    scan_mode_id: scanModeId,
    name: name ?? `Item ${id}`,
    enabled: 1,
    settings: JSON.stringify(settings),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertNorthConnector(db: Knex, id: string, type: string, settings: unknown, scanModeId: string) {
  await db('north_connectors').insert({
    id,
    name: `North ${id}`,
    type,
    description: '',
    enabled: 1,
    settings: JSON.stringify(settings),
    caching_scan_mode_id: scanModeId,
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSubscription(db: Knex, northId: string, southId: string) {
  await db('subscription').insert({
    north_connector_id: northId,
    south_connector_id: southId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertExternalSource(db: Knex, id: string, reference: string) {
  await db('external_sources').insert({
    id,
    reference,
    description: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function _insertExternalSubscription(db: Knex, northId: string, externalSourceId: string) {
  await db('external_subscription').insert({
    north_connector_id: northId,
    external_source_id: externalSourceId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertHistoryQuery(
  db: Knex,
  id: string,
  southType: string,
  northType: string,
  southSettings: unknown,
  northSettings: unknown,
  scanModeId: string,
  overrides: Partial<{ history_max_read_interval: number; history_read_delay: number; history_max_instant_per_item: number }> = {}
) {
  await db('history_queries').insert({
    id,
    status: 'PENDING',
    name: `History ${id}`,
    description: '',
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-02T00:00:00Z',
    south_type: southType,
    north_type: northType,
    south_settings: JSON.stringify(southSettings),
    north_settings: JSON.stringify(northSettings),
    history_max_instant_per_item: overrides.history_max_instant_per_item ?? 0,
    history_max_read_interval: overrides.history_max_read_interval ?? 3600,
    history_read_delay: overrides.history_read_delay ?? 200,
    caching_scan_mode_id: scanModeId,
    caching_group_count: 1000,
    caching_retry_interval: 5000,
    caching_retry_count: 3,
    caching_max_send_count: 1000,
    caching_send_file_immediately: 1,
    caching_max_size: 0,
    archive_enabled: 0,
    archive_retention_duration: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertHistoryItem(db: Knex, id: string, historyId: string, settings: unknown, name?: string) {
  await db('history_items').insert({
    id,
    history_id: historyId,
    name: name ?? `HistoryItem ${id}`,
    enabled: 1,
    description: '',
    settings: JSON.stringify(settings),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertCommand(db: Knex, id: string, type: string, upgradeVersion?: string, upgradeAssetId?: string) {
  await db('commands').insert({
    id,
    type,
    status: 'COMPLETED',
    ack: 0,
    retrieved_date: null,
    completed_date: null,
    result: null,
    upgrade_version: upgradeVersion ?? null,
    upgrade_asset_id: upgradeAssetId ?? null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertRegistration(db: Knex, id: string, host: string, activationCode: string, checkUrl: string) {
  await db('registrations').insert({
    id,
    host,
    use_proxy: 0,
    proxy_url: null,
    proxy_username: null,
    proxy_password: null,
    accept_unauthorized: '0',
    activation_code: activationCode,
    check_url: checkUrl,
    activation_date: null,
    activation_expiration_date: null,
    token: null,
    status: 'REGISTERED',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertOiaMessage(db: Knex, id: string) {
  await db('oianalytics_messages').insert({
    id,
    type: 'info',
    content: JSON.stringify({ some: 'content' }),
    completed_date: null,
    error: null,
    status: 'PENDING',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

const OPCUA_SECURITY_MODE_CASES: Array<{ old: string; expected: string }> = [
  { old: 'None', expected: 'none' },
  { old: 'Sign', expected: 'sign' },
  { old: 'SignAndEncrypt', expected: 'sign-and-encrypt' }
];

const OPCUA_SECURITY_POLICY_CASES: Array<{ old: string; expected: string }> = [
  { old: 'None', expected: 'none' },
  { old: 'Basic128', expected: 'basic128' },
  { old: 'Basic192', expected: 'basic192' },
  { old: 'Basic256', expected: 'basic128' },
  { old: 'Basic128Rsa15', expected: 'basic128' },
  { old: 'Basic192Rsa15', expected: 'basic192-rsa15' },
  { old: 'Basic256Rsa15', expected: 'basic256-rsa15' },
  { old: 'Basic256Sha256', expected: 'basic256-sha256' },
  { old: 'Aes128_Sha256_RsaOaep', expected: 'aes128-sha256-rsa-oaep' },
  { old: 'PubSub_Aes128_CTR', expected: 'pub-sub-aes-128-ctr' },
  { old: 'PubSub_Aes256_CTR', expected: 'pub-sub-aes-256-ctr' }
];

const MODBUS_DATA_TYPE_CASES: Array<{ old: string; expected: string }> = [
  { old: 'UInt16', expected: 'uint16' },
  { old: 'Int16', expected: 'int16' },
  { old: 'UInt32', expected: 'uint32' },
  { old: 'Int32', expected: 'uint32' },
  { old: 'BigUInt64', expected: 'big-uint64' },
  { old: 'BigInt64', expected: 'big-int64' },
  { old: 'Float', expected: 'float' },
  { old: 'Double', expected: 'double' },
  { old: 'Bit', expected: 'bit' }
];

const MODBUS_REGISTER_TYPE_CASES: Array<{ old: string; expected: string }> = [
  { old: 'coil', expected: 'coil' },
  { old: 'discreteInput', expected: 'discrete-input' },
  { old: 'inputRegister', expected: 'input-register' },
  { old: 'holdingRegister', expected: 'holding-register' }
];

const THROTTLING_ONLY_TYPES = ['mssql', 'mysql', 'odbc', 'oianalytics', 'oledb', 'oracle', 'postgresql', 'slims', 'sqlite'];

describe('Entity migration v3.5.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v350-'));
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
    await insertEngine(db);
    await insertScanMode(db, 'scan-mode-1');
  });

  it('runs end-to-end on a realistic pre-3.5.0 schema', async () => {
    await up(db); // must not throw
  });

  describe('removeExternalSubscriptions', () => {
    it('drops external_subscription and external_sources tables', async () => {
      await insertExternalSource(db, 'ext-1', 'ref-1');

      await up(db);

      assert.strictEqual(await db.schema.hasTable('external_subscription'), false);
      assert.strictEqual(await db.schema.hasTable('external_sources'), false);
    });
  });

  describe('removeNorthOIBusConnectors', () => {
    it('removes north connectors of type oibus and their subscriptions', async () => {
      await insertSouthConnector(db, 'south-1', 'folder-scanner', { inputFolder: 'input', compression: false });
      await insertNorthConnector(db, 'north-oibus-1', 'oibus', {}, 'scan-mode-1');
      await insertSubscription(db, 'north-oibus-1', 'south-1');

      await up(db);

      const north = await db('north_connectors').where('id', 'north-oibus-1').first();
      assert.strictEqual(north, undefined, 'oibus north connector removed');

      const subscription = await db('subscription').where('north_connector_id', 'north-oibus-1').first();
      assert.strictEqual(subscription, undefined, 'associated subscription removed');
    });

    it('leaves non-oibus north connectors untouched', async () => {
      await insertNorthConnector(db, 'north-fw-1', 'file-writer', { outputFolder: 'output', prefix: null, suffix: null }, 'scan-mode-1');

      await up(db);

      const north = await db('north_connectors').where('id', 'north-fw-1').first();
      assert.ok(north, 'non-oibus north connector kept');
    });
  });

  describe('removeNorthOIBusHistoryQueries', () => {
    it('removes history queries of north_type oibus and their history items', async () => {
      await insertHistoryQuery(
        db,
        'history-oibus-1',
        'folder-scanner',
        'oibus',
        { inputFolder: 'input', compression: false },
        {},
        'scan-mode-1'
      );
      await insertHistoryItem(db, 'hitem-1', 'history-oibus-1', { inputFolder: 'input', compression: false });

      await up(db);

      const historyQuery = await db('history_queries').where('id', 'history-oibus-1').first();
      assert.strictEqual(historyQuery, undefined, 'oibus history query removed');

      const historyItem = await db('history_items').where('id', 'hitem-1').first();
      assert.strictEqual(historyItem, undefined, 'associated history item removed');
    });
  });

  describe('updateNorthConnectors', () => {
    it('maps azure-blob authentication values and adds useADLS: false', async () => {
      const cases: Array<{ old: string; expected: string }> = [
        { old: 'accessKey', expected: 'access-key' },
        { old: 'sasToken', expected: 'sas-token' },
        { old: 'aad', expected: 'aad' },
        { old: 'external', expected: 'external' }
      ];
      for (const [index, { old: authentication }] of cases.entries()) {
        await insertNorthConnector(
          db,
          `azure-${index}`,
          'azure-blob',
          { account: 'account', container: 'container', path: null, authentication },
          'scan-mode-1'
        );
      }

      await up(db);

      for (const [index, { expected }] of cases.entries()) {
        const row = await db('north_connectors').where('id', `azure-${index}`).first();
        const settings = JSON.parse(row.settings);
        assert.strictEqual(settings.authentication, expected, `authentication ${cases[index].old} -> ${expected}`);
        assert.strictEqual(settings.useADLS, false);
        assert.strictEqual(settings.account, 'account', 'existing settings preserved');
      }
    });

    it('leaves settings of non-azure-blob north connectors unchanged', async () => {
      const oldSettings = { outputFolder: 'output', prefix: null, suffix: null };
      await insertNorthConnector(db, 'north-fw-2', 'file-writer', oldSettings, 'scan-mode-1');

      await up(db);

      const row = await db('north_connectors').where('id', 'north-fw-2').first();
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(settings, oldSettings);
    });
  });

  describe('updateSouthConnectors', () => {
    it('recreates south_items, subscription and south_connectors while preserving data and foreign keys', async () => {
      await insertSouthConnector(db, 'south-preserve-1', 'folder-scanner', { inputFolder: 'input', compression: false });
      await insertSouthItem(db, 'item-preserve-1', 'south-preserve-1', 'scan-mode-1', { path: '*.csv' });
      await insertNorthConnector(
        db,
        'north-preserve-1',
        'file-writer',
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1'
      );
      await insertSubscription(db, 'north-preserve-1', 'south-preserve-1');

      await up(db);

      const south = await db('south_connectors').where('id', 'south-preserve-1').first();
      assert.ok(south, 'south connector preserved');
      const item = await db('south_items').where('id', 'item-preserve-1').first();
      assert.ok(item, 'south item preserved');
      assert.strictEqual(item.connector_id, 'south-preserve-1');
      const subscription = await db('subscription').where('north_connector_id', 'north-preserve-1').first();
      assert.ok(subscription, 'subscription preserved');
    });

    it('enforces a unique index on south_items (connector_id, name)', async () => {
      await insertSouthConnector(db, 'south-unique-1', 'folder-scanner', { inputFolder: 'input', compression: false });
      await insertSouthItem(db, 'item-unique-1', 'south-unique-1', 'scan-mode-1', { path: '*.csv' }, 'Same Name');

      await up(db);

      await assert.rejects(() =>
        db('south_items').insert({
          id: 'item-unique-2',
          connector_id: 'south-unique-1',
          scan_mode_id: 'scan-mode-1',
          name: 'Same Name',
          enabled: 1,
          settings: '{}',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        })
      );
    });

    it('rewrites ads settings enumAsText and boolAsText', async () => {
      await insertSouthConnector(db, 'ads-1', 'ads', { enumAsText: 'Text', boolAsText: 'Integer' });

      await up(db);

      const row = await db('south_connectors').where('id', 'ads-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.enumAsText, 'text');
      assert.strictEqual(settings.boolAsText, 'integer');
    });

    it('rewrites modbus endianness and addressOffset for both enum values', async () => {
      await insertSouthConnector(db, 'modbus-1', 'modbus', { endianness: 'Big Endian', addressOffset: 'JBus' });
      await insertSouthConnector(db, 'modbus-2', 'modbus', { endianness: 'Little Endian', addressOffset: 'Modbus' });

      await up(db);

      const row1 = await db('south_connectors').where('id', 'modbus-1').first();
      const settings1 = JSON.parse(row1.settings);
      assert.strictEqual(settings1.endianness, 'big-endian');
      assert.strictEqual(settings1.addressOffset, 'jbus');

      const row2 = await db('south_connectors').where('id', 'modbus-2').first();
      const settings2 = JSON.parse(row2.settings);
      assert.strictEqual(settings2.endianness, 'little-endian');
      assert.strictEqual(settings2.addressOffset, 'modbus');
    });

    it('sets throttling from history_* columns for every throttling-only south type', async () => {
      for (const [index, type] of THROTTLING_ONLY_TYPES.entries()) {
        await insertSouthConnector(
          db,
          `throttle-${index}`,
          type,
          { host: 'host' },
          {
            history_max_read_interval: 1000 + index,
            history_read_delay: 100 + index,
            history_read_overlap: 10 + index
          }
        );
      }

      await up(db);

      for (const [index, type] of THROTTLING_ONLY_TYPES.entries()) {
        const row = await db('south_connectors').where('id', `throttle-${index}`).first();
        const settings = JSON.parse(row.settings);
        assert.deepStrictEqual(
          settings.throttling,
          { maxReadInterval: 1000 + index, readDelay: 100 + index, overlap: 10 + index },
          `throttling set for ${type}`
        );
        assert.strictEqual(row.type, type, `type ${type} unchanged`);
      }
    });

    it('renames opc-hda to opc and sets throttling with maxInstantPerItem', async () => {
      await insertSouthConnector(
        db,
        'opc-hda-1',
        'opc-hda',
        { host: 'host' },
        {
          history_max_read_interval: 500,
          history_read_delay: 50,
          history_read_overlap: 5,
          history_max_instant_per_item: 1
        }
      );

      await up(db);

      const row = await db('south_connectors').where('id', 'opc-hda-1').first();
      assert.strictEqual(row.type, 'opc');
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(settings.throttling, { maxReadInterval: 500, readDelay: 50, overlap: 5, maxInstantPerItem: 1 });
    });

    it('rewrites opcua settings: sharedConnection, throttling, securityMode and securityPolicy for every enum value', async () => {
      for (const [index, { old: securityPolicy }] of OPCUA_SECURITY_POLICY_CASES.entries()) {
        const securityMode = OPCUA_SECURITY_MODE_CASES[index % OPCUA_SECURITY_MODE_CASES.length].old;
        await insertSouthConnector(
          db,
          `opcua-${index}`,
          'opcua',
          { url: 'opc.tcp://localhost:4840', securityMode, securityPolicy },
          {
            history_max_read_interval: 100,
            history_read_delay: 10,
            history_read_overlap: 1,
            history_max_instant_per_item: 0
          }
        );
      }

      await up(db);

      for (const [index, { old: securityPolicy, expected: expectedPolicy }] of OPCUA_SECURITY_POLICY_CASES.entries()) {
        const expectedMode = OPCUA_SECURITY_MODE_CASES[index % OPCUA_SECURITY_MODE_CASES.length].expected;
        const row = await db('south_connectors').where('id', `opcua-${index}`).first();
        const settings = JSON.parse(row.settings);
        assert.strictEqual(settings.sharedConnection, false);
        assert.deepStrictEqual(settings.throttling, { maxReadInterval: 100, readDelay: 10, overlap: 1, maxInstantPerItem: 0 });
        assert.strictEqual(settings.securityMode, expectedMode);
        assert.strictEqual(settings.securityPolicy, expectedPolicy, `policy ${securityPolicy} -> ${expectedPolicy}`);
      }
    });

    it('sets throttling with maxInstantPerItem for osisoft-pi', async () => {
      await insertSouthConnector(
        db,
        'osisoft-1',
        'osisoft-pi',
        { host: 'host' },
        {
          history_max_read_interval: 700,
          history_read_delay: 70,
          history_read_overlap: 7,
          history_max_instant_per_item: 1
        }
      );

      await up(db);

      const row = await db('south_connectors').where('id', 'osisoft-1').first();
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(settings.throttling, { maxReadInterval: 700, readDelay: 70, overlap: 7, maxInstantPerItem: 1 });
    });

    it('leaves settings of untransformed south types unchanged (besides being re-serialized)', async () => {
      const oldSettings = { inputFolder: 'input', compression: false };
      await insertSouthConnector(db, 'folder-scanner-2', 'folder-scanner', oldSettings);

      await up(db);

      const row = await db('south_connectors').where('id', 'folder-scanner-2').first();
      assert.strictEqual(row.type, 'folder-scanner');
      const settings = JSON.parse(row.settings);
      assert.deepStrictEqual(settings, oldSettings);
    });
  });

  describe('updateSouthConnectorItems', () => {
    it('rewrites opcua item mode for both HA and DA', async () => {
      await insertSouthConnector(db, 'opcua-items-1', 'opcua', {
        url: 'opc.tcp://localhost:4840',
        securityMode: 'None',
        securityPolicy: 'None'
      });
      await insertSouthItem(db, 'opcua-item-ha', 'opcua-items-1', 'scan-mode-1', { mode: 'HA' }, 'HA item');
      await insertSouthItem(db, 'opcua-item-da', 'opcua-items-1', 'scan-mode-1', { mode: 'DA' }, 'DA item');

      await up(db);

      const ha = await db('south_items').where('id', 'opcua-item-ha').first();
      assert.strictEqual(JSON.parse(ha.settings).mode, 'ha');
      const da = await db('south_items').where('id', 'opcua-item-da').first();
      assert.strictEqual(JSON.parse(da.settings).mode, 'da');
    });

    it('rewrites modbus item modbusType and data.dataType for every enum value, when data is present', async () => {
      await insertSouthConnector(db, 'modbus-items-1', 'modbus', { endianness: 'Big Endian', addressOffset: 'Modbus' });
      const count = Math.max(MODBUS_DATA_TYPE_CASES.length, MODBUS_REGISTER_TYPE_CASES.length);
      for (let index = 0; index < count; index++) {
        const { old: modbusType } = MODBUS_REGISTER_TYPE_CASES[index % MODBUS_REGISTER_TYPE_CASES.length];
        const { old: dataType } = MODBUS_DATA_TYPE_CASES[index % MODBUS_DATA_TYPE_CASES.length];
        await insertSouthItem(
          db,
          `modbus-item-${index}`,
          'modbus-items-1',
          'scan-mode-1',
          { modbusType, data: { dataType, multiplierCoefficient: 1, bitIndex: 0 } },
          `Modbus item ${index}`
        );
      }

      await up(db);

      for (let index = 0; index < count; index++) {
        const { expected: expectedRegisterType } = MODBUS_REGISTER_TYPE_CASES[index % MODBUS_REGISTER_TYPE_CASES.length];
        const { expected: expectedDataType } = MODBUS_DATA_TYPE_CASES[index % MODBUS_DATA_TYPE_CASES.length];
        const row = await db('south_items').where('id', `modbus-item-${index}`).first();
        const settings = JSON.parse(row.settings);
        assert.strictEqual(settings.modbusType, expectedRegisterType);
        assert.strictEqual(settings.data.dataType, expectedDataType);
      }
    });

    it('rewrites modbus item modbusType without touching data when data is absent', async () => {
      await insertSouthConnector(db, 'modbus-items-2', 'modbus', { endianness: 'Big Endian', addressOffset: 'Modbus' });
      await insertSouthItem(db, 'modbus-item-nodata', 'modbus-items-2', 'scan-mode-1', { modbusType: 'coil' }, 'No data item');

      await up(db);

      const row = await db('south_items').where('id', 'modbus-item-nodata').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.modbusType, 'coil');
      assert.strictEqual(settings.data, undefined);
    });

    it('rewrites osisoft-pi item type for both pointId and pointQuery', async () => {
      await insertSouthConnector(db, 'osisoft-items-1', 'osisoft-pi', { host: 'host' });
      await insertSouthItem(db, 'osisoft-item-point-id', 'osisoft-items-1', 'scan-mode-1', { type: 'pointId' }, 'Point id item');
      await insertSouthItem(db, 'osisoft-item-point-query', 'osisoft-items-1', 'scan-mode-1', { type: 'pointQuery' }, 'Point query item');

      await up(db);

      const pointId = await db('south_items').where('id', 'osisoft-item-point-id').first();
      assert.strictEqual(JSON.parse(pointId.settings).type, 'point-id');
      const pointQuery = await db('south_items').where('id', 'osisoft-item-point-query').first();
      assert.strictEqual(JSON.parse(pointQuery.settings).type, 'point-query');
    });

    it('leaves settings of items belonging to untransformed south types unchanged', async () => {
      await insertSouthConnector(db, 'folder-scanner-items-1', 'folder-scanner', { inputFolder: 'input', compression: false });
      const oldSettings = { path: '*.csv' };
      await insertSouthItem(db, 'folder-scanner-item-1', 'folder-scanner-items-1', 'scan-mode-1', oldSettings);

      await up(db);

      const row = await db('south_items').where('id', 'folder-scanner-item-1').first();
      assert.deepStrictEqual(JSON.parse(row.settings), oldSettings);
    });
  });

  describe('updateHistoryQueries', () => {
    it('recreates history_items and history_queries while preserving data', async () => {
      await insertHistoryQuery(
        db,
        'history-preserve-1',
        'folder-scanner',
        'file-writer',
        { inputFolder: 'input', compression: false },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1'
      );
      await insertHistoryItem(db, 'hitem-preserve-1', 'history-preserve-1', { path: '*.csv' });

      await up(db);

      const historyQuery = await db('history_queries').where('id', 'history-preserve-1').first();
      assert.ok(historyQuery, 'history query preserved');
      const historyItem = await db('history_items').where('id', 'hitem-preserve-1').first();
      assert.ok(historyItem, 'history item preserved');
      assert.strictEqual(historyItem.history_id, 'history-preserve-1');
    });

    it('rewrites throttling (overlap forced to 0) for every throttling-only south type in a history query', async () => {
      for (const [index, type] of THROTTLING_ONLY_TYPES.entries()) {
        await insertHistoryQuery(
          db,
          `history-throttle-${index}`,
          type,
          'file-writer',
          { host: 'host' },
          { outputFolder: 'output', prefix: null, suffix: null },
          'scan-mode-1',
          { history_max_read_interval: 900 + index, history_read_delay: 90 + index }
        );
      }

      await up(db);

      for (const [index, type] of THROTTLING_ONLY_TYPES.entries()) {
        const row = await db('history_queries').where('id', `history-throttle-${index}`).first();
        const settings = JSON.parse(row.south_settings);
        assert.deepStrictEqual(
          settings.throttling,
          { maxReadInterval: 900 + index, readDelay: 90 + index, overlap: 0 },
          `throttling set for ${type}`
        );
        assert.strictEqual(row.south_type, type);
      }
    });

    it('renames opc-hda south_type to opc with maxInstantPerItem throttling', async () => {
      await insertHistoryQuery(
        db,
        'history-opc-hda-1',
        'opc-hda',
        'file-writer',
        { host: 'host' },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1',
        { history_max_read_interval: 400, history_read_delay: 40, history_max_instant_per_item: 1 }
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-opc-hda-1').first();
      assert.strictEqual(row.south_type, 'opc');
      const settings = JSON.parse(row.south_settings);
      assert.deepStrictEqual(settings.throttling, { maxReadInterval: 400, readDelay: 40, overlap: 0, maxInstantPerItem: 1 });
    });

    it('rewrites opcua settings (sharedConnection, throttling, securityMode, securityPolicy) in a history query', async () => {
      await insertHistoryQuery(
        db,
        'history-opcua-1',
        'opcua',
        'file-writer',
        { url: 'opc.tcp://localhost:4840', securityMode: 'SignAndEncrypt', securityPolicy: 'Basic256Sha256' },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1',
        { history_max_read_interval: 300, history_read_delay: 30, history_max_instant_per_item: 1 }
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-opcua-1').first();
      const settings = JSON.parse(row.south_settings);
      assert.strictEqual(settings.sharedConnection, false);
      assert.deepStrictEqual(settings.throttling, { maxReadInterval: 300, readDelay: 30, overlap: 0, maxInstantPerItem: 1 });
      assert.strictEqual(settings.securityMode, 'sign-and-encrypt');
      assert.strictEqual(settings.securityPolicy, 'basic256-sha256');
    });

    it('sets throttling with maxInstantPerItem for osisoft-pi south type', async () => {
      await insertHistoryQuery(
        db,
        'history-osisoft-1',
        'osisoft-pi',
        'file-writer',
        { host: 'host' },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1',
        { history_max_read_interval: 800, history_read_delay: 80, history_max_instant_per_item: 1 }
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-osisoft-1').first();
      const settings = JSON.parse(row.south_settings);
      assert.deepStrictEqual(settings.throttling, { maxReadInterval: 800, readDelay: 80, overlap: 0, maxInstantPerItem: 1 });
    });

    it('rewrites azure-blob north_settings authentication and adds useADLS: false', async () => {
      await insertHistoryQuery(
        db,
        'history-azure-1',
        'folder-scanner',
        'azure-blob',
        { inputFolder: 'input', compression: false },
        { account: 'account', container: 'container', path: null, authentication: 'sasToken' },
        'scan-mode-1'
      );

      await up(db);

      const row = await db('history_queries').where('id', 'history-azure-1').first();
      const settings = JSON.parse(row.north_settings);
      assert.strictEqual(settings.authentication, 'sas-token');
      assert.strictEqual(settings.useADLS, false);
    });

    it('leaves settings of untransformed south/north types unchanged', async () => {
      const southSettings = { inputFolder: 'input', compression: false };
      const northSettings = { outputFolder: 'output', prefix: null, suffix: null };
      await insertHistoryQuery(db, 'history-untouched-1', 'folder-scanner', 'file-writer', southSettings, northSettings, 'scan-mode-1');

      await up(db);

      const row = await db('history_queries').where('id', 'history-untouched-1').first();
      assert.deepStrictEqual(JSON.parse(row.south_settings), southSettings);
      assert.deepStrictEqual(JSON.parse(row.north_settings), northSettings);
    });
  });

  describe('updateHistoryQueryItems', () => {
    it('rewrites opcua history item mode for both HA and DA', async () => {
      await insertHistoryQuery(
        db,
        'history-opcua-items-1',
        'opcua',
        'file-writer',
        { url: 'opc.tcp://localhost:4840', securityMode: 'None', securityPolicy: 'None' },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1'
      );
      await insertHistoryItem(db, 'hitem-opcua-ha', 'history-opcua-items-1', { mode: 'HA' }, 'HA history item');
      await insertHistoryItem(db, 'hitem-opcua-da', 'history-opcua-items-1', { mode: 'DA' }, 'DA history item');

      await up(db);

      const ha = await db('history_items').where('id', 'hitem-opcua-ha').first();
      assert.strictEqual(JSON.parse(ha.settings).mode, 'ha');
      const da = await db('history_items').where('id', 'hitem-opcua-da').first();
      assert.strictEqual(JSON.parse(da.settings).mode, 'da');
    });

    it('rewrites osisoft-pi history item type for both pointId and pointQuery', async () => {
      await insertHistoryQuery(
        db,
        'history-osisoft-items-1',
        'osisoft-pi',
        'file-writer',
        { host: 'host' },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1'
      );
      await insertHistoryItem(db, 'hitem-osisoft-point-id', 'history-osisoft-items-1', { type: 'pointId' }, 'Point id history item');
      await insertHistoryItem(
        db,
        'hitem-osisoft-point-query',
        'history-osisoft-items-1',
        { type: 'pointQuery' },
        'Point query history item'
      );

      await up(db);

      const pointId = await db('history_items').where('id', 'hitem-osisoft-point-id').first();
      assert.strictEqual(JSON.parse(pointId.settings).type, 'point-id');
      const pointQuery = await db('history_items').where('id', 'hitem-osisoft-point-query').first();
      assert.strictEqual(JSON.parse(pointQuery.settings).type, 'point-query');
    });

    it('leaves settings of history items belonging to untransformed south types unchanged', async () => {
      await insertHistoryQuery(
        db,
        'history-untouched-items-1',
        'folder-scanner',
        'file-writer',
        { inputFolder: 'input', compression: false },
        { outputFolder: 'output', prefix: null, suffix: null },
        'scan-mode-1'
      );
      const oldSettings = { path: '*.csv' };
      await insertHistoryItem(db, 'hitem-untouched-1', 'history-untouched-items-1', oldSettings);

      await up(db);

      const row = await db('history_items').where('id', 'hitem-untouched-1').first();
      assert.deepStrictEqual(JSON.parse(row.settings), oldSettings);
    });
  });

  describe('updateOIAMessageTable', () => {
    it('deletes all rows and drops the content column', async () => {
      await insertOiaMessage(db, 'msg-1');

      await up(db);

      const rows = await db('oianalytics_messages').select();
      assert.strictEqual(rows.length, 0, 'all rows deleted');
      const cols = await columnNames(db, 'oianalytics_messages');
      assert.ok(!cols.includes('content'), 'content column dropped');
    });
  });

  describe('recreateCommandTable', () => {
    it('adds south_connector_id, north_connector_id, scan_mode_id columns and sets target_version', async () => {
      await insertCommand(db, 'command-other', 'restart-engine');

      await up(db);

      const cols = await columnNames(db, 'commands');
      assert.ok(cols.includes('south_connector_id'));
      assert.ok(cols.includes('north_connector_id'));
      assert.ok(cols.includes('scan_mode_id'));

      const row = await db('commands').where('id', 'command-other').first();
      assert.strictEqual(row.target_version, 'v3.5.0');
      assert.strictEqual(row.command_content, '', 'non update commands get an empty command_content');
    });

    it('builds command_content and normalizes type for update-version and UPGRADE commands', async () => {
      await insertCommand(db, 'command-update', 'update-version', '3.5.0', 'asset-1');
      await insertCommand(db, 'command-upgrade', 'UPGRADE', '3.5.0', 'asset-2');

      await up(db);

      const updateRow = await db('commands').where('id', 'command-update').first();
      assert.strictEqual(updateRow.type, 'update-version');
      assert.deepStrictEqual(JSON.parse(updateRow.command_content), {
        version: '3.5.0',
        assetId: 'asset-1',
        updateLauncher: false,
        backupFolders: '*'
      });

      const upgradeRow = await db('commands').where('id', 'command-upgrade').first();
      assert.strictEqual(upgradeRow.type, 'update-version', 'UPGRADE type normalized to update-version');
      assert.deepStrictEqual(JSON.parse(upgradeRow.command_content), {
        version: '3.5.0',
        assetId: 'asset-2',
        updateLauncher: false,
        backupFolders: '*'
      });
    });
  });

  describe('updateRegistrationSettings', () => {
    it('adds registration columns and defaults command flags to true', async () => {
      await insertRegistration(db, 'registration-1', 'https://oia.example.com', 'ABC', 'https://check');

      await up(db);

      const cols = await columnNames(db, 'registrations');
      for (const expected of [
        'public_key',
        'private_key',
        'command_retry_interval',
        'message_retry_interval',
        'command_refresh_interval',
        'command_update_version',
        'command_create_south',
        'command_delete_north'
      ]) {
        assert.ok(cols.includes(expected), `registrations.${expected} added`);
      }

      const row = await db('registrations').where('id', 'registration-1').first();
      assert.strictEqual(row.command_refresh_interval, 10);
      assert.strictEqual(row.command_retry_interval, 5);
      assert.strictEqual(row.message_retry_interval, 5);
      assert.strictEqual(!!row.command_update_version, true);
      assert.strictEqual(!!row.command_create_south, true);
      assert.strictEqual(!!row.command_delete_north, true);
    });
  });

  describe('updateEngineTable', () => {
    it('adds oibus_launcher_version and sets it to 3.4.0 for existing rows', async () => {
      await up(db);

      const cols = await columnNames(db, 'engines');
      assert.ok(cols.includes('oibus_launcher_version'));
      const engine = await db('engines').where('id', 'engine-1').first();
      assert.strictEqual(engine.oibus_launcher_version, '3.4.0');
    });
  });

  it('down is a no-op', async () => {
    await insertSouthConnector(db, 'south-down-1', 'folder-scanner', { inputFolder: 'input', compression: false });

    await up(db);
    await down(db);

    const row = await db('south_connectors').where('id', 'south-down-1').first();
    assert.ok(row, 'down does not revert the up() migration');
  });
});
