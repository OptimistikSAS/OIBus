import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.11.0';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({
    id,
    name: 'Every 10s',
    description: '',
    cron: '*/10 * * * * *',
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertSouthConnector(db: Knex, id = 'south-1', type = 'modbus') {
  await db('south_connectors').insert({
    id,
    name: `Test ${type}`,
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

async function insertGroup(db: Knex, southId: string, id = 'group-1') {
  await db('south_item_groups').insert({
    id,
    name: 'Group A',
    south_id: southId,
    scan_mode_id: 'scan-mode-1',
    max_read_interval: 3600,
    read_delay: 200,
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

async function insertItem(db: Knex, connectorId: string, id = 'item-1') {
  await db('south_items').insert({
    id,
    name: 'Item A',
    enabled: 1,
    connector_id: connectorId,
    scan_mode_id: null,
    settings: '{}',
    sync_with_group: 1,
    max_read_interval: null,
    read_delay: null,
    created_by: 'admin',
    updated_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });
}

describe('Entity migration v3.11.0', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.11.0.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.11.0 schema', async () => {
    await up(db); // must not throw
  });

  describe('caching_strategy / threshold columns', () => {
    it('adds caching_strategy to south_item_groups', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_item_groups');
      assert.ok(cols.includes('caching_strategy'), 'south_item_groups.caching_strategy added');
    });

    it('adds caching_strategy, threshold_type, threshold, range_low, range_high, max_caching_interval to south_items', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_items');
      assert.ok(cols.includes('caching_strategy'), 'south_items.caching_strategy added');
      assert.ok(cols.includes('threshold_type'), 'south_items.threshold_type added');
      assert.ok(cols.includes('threshold'), 'south_items.threshold added');
      assert.ok(cols.includes('range_low'), 'south_items.range_low added');
      assert.ok(cols.includes('range_high'), 'south_items.range_high added');
      assert.ok(cols.includes('max_caching_interval'), 'south_items.max_caching_interval added');
    });

    it("backfills caching_strategy to 'allValues' for items and groups of an IoT-family connector (modbus)", async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'modbus');
      await insertGroup(db, 'south-1');
      await insertItem(db, 'south-1');

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.caching_strategy, 'allValues', "IoT-family connector's group row defaults to 'allValues'");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.caching_strategy, 'allValues', "IoT-family connector's item row defaults to 'allValues'");
    });

    it('backfills caching_strategy for every IoT-family type (opcua, modbus, ads, opc, s7, mqtt)', async () => {
      await insertScanMode(db);
      const iotTypes = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];
      for (const [index, type] of iotTypes.entries()) {
        const southId = `south-${type}-${index}`;
        await insertSouthConnector(db, southId, type);
        await insertGroup(db, southId, `group-${type}-${index}`);
        await insertItem(db, southId, `item-${type}-${index}`);
      }

      await up(db);

      for (const [index, type] of iotTypes.entries()) {
        const group = await db('south_item_groups').where('id', `group-${type}-${index}`).first();
        assert.strictEqual(group.caching_strategy, 'allValues', `${type} group row defaults to 'allValues'`);
        const item = await db('south_items').where('id', `item-${type}-${index}`).first();
        assert.strictEqual(item.caching_strategy, 'allValues', `${type} item row defaults to 'allValues'`);
      }
    });

    it('leaves caching_strategy null for items and groups of a non-IoT-family connector (sqlite)', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'sqlite');
      await insertGroup(db, 'south-1');
      await insertItem(db, 'south-1');

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.caching_strategy, null, "non-IoT-family connector's group row stays null");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.caching_strategy, null, "non-IoT-family connector's item row stays null");
    });

    it('leaves threshold_type, threshold, range_low, range_high, max_caching_interval null for all rows', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'modbus');
      await insertGroup(db, 'south-1');
      await insertItem(db, 'south-1');

      await up(db);

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.threshold_type, null);
      assert.strictEqual(item.threshold, null);
      assert.strictEqual(item.range_low, null);
      assert.strictEqual(item.range_high, null);
      assert.strictEqual(item.max_caching_interval, null);
    });

    it('drops all added columns on down', async () => {
      await up(db);
      await down(db);

      const groupCols = await columnNames(db, 'south_item_groups');
      assert.ok(!groupCols.includes('caching_strategy'), 'south_item_groups.caching_strategy removed');

      const itemCols = await columnNames(db, 'south_items');
      assert.ok(!itemCols.includes('caching_strategy'), 'south_items.caching_strategy removed');
      assert.ok(!itemCols.includes('threshold_type'), 'south_items.threshold_type removed');
      assert.ok(!itemCols.includes('threshold'), 'south_items.threshold removed');
      assert.ok(!itemCols.includes('range_low'), 'south_items.range_low removed');
      assert.ok(!itemCols.includes('range_high'), 'south_items.range_high removed');
      assert.ok(!itemCols.includes('max_caching_interval'), 'south_items.max_caching_interval removed');
    });

    it('down preserves existing rows', async () => {
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'modbus');
      await insertGroup(db, 'south-1');
      await insertItem(db, 'south-1');

      await up(db);
      await down(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.ok(group, 'group row survives the rollback');
      const item = await db('south_items').where('id', 'item-1').first();
      assert.ok(item, 'item row survives the rollback');
    });
  });

  describe('dropping the added columns when still referenced by other tables', () => {
    it('does not fail with a FOREIGN KEY constraint error when group_items rows still reference south_item_groups/south_items, inside a real transaction', async () => {
      // Reproduces the production migration runner, which always wraps each migration file's up()/down() in a
      // knex.transaction(...). Inside that transaction, knex's schema builder cannot toggle
      // `PRAGMA foreign_keys` around a dropColumn()-driven table rebuild, so DROP TABLE south_items/
      // south_item_groups would fail while group_items still holds rows referencing them.
      await insertScanMode(db);
      await insertSouthConnector(db, 'south-1', 'modbus');
      await insertGroup(db, 'south-1');
      await insertItem(db, 'south-1');
      await db('group_items').insert({ group_id: 'group-1', item_id: 'item-1' });

      await db.transaction(async trx => {
        await up(trx);
        await down(trx);
      });

      const groupItemsRows = await db('group_items').select('*');
      assert.deepStrictEqual(groupItemsRows, [{ group_id: 'group-1', item_id: 'item-1' }], 'group_items row is preserved');
    });
  });
});
