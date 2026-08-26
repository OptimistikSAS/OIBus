import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_4';

describe('Entity migration v3.10.0_4', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.raw('PRAGMA foreign_keys = ON');
    await buildPreMigrationSchema(db, 'v3.10.0_4');

    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert({
      id: 'south1',
      name: 'South 1',
      type: 'opcua',
      enabled: true,
      settings: JSON.stringify({})
    });
    await db('south_items').insert({
      id: 'item1',
      connector_id: 'south1',
      scan_mode_id: 'sm1',
      name: 'item1',
      enabled: true,
      settings: JSON.stringify({})
    });
  });

  describe('up', () => {
    it('creates the configuration_workflows table, self-scoped (no target item)', async () => {
      await up(db);

      await db('configuration_workflows').insert({
        id: 'workflow1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        created_by: 'user1',
        updated_by: 'user1',
        south_id: 'south1',
        target_item_id: null,
        discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
        identity_key_fields: JSON.stringify(['nodeId']),
        eligibility_filter: JSON.stringify([{ field: 'type', operator: 'equals', value: 'Variable' }]),
        item_field_mapping: JSON.stringify({ name: '{{name}}', 'settings.nodeId': '{{nodeId}}' }),
        remote_field_mapping: null,
        scan_mode_id: 'sm1',
        enabled: true
      });

      const row = await db('configuration_workflows').where('id', 'workflow1').first();
      assert.strictEqual(row.south_id, 'south1');
      assert.strictEqual(row.target_item_id, null);
      assert.strictEqual(row.discovery_scope, JSON.stringify({ rootNodeId: 'ns=1;s=Root' }));
      assert.strictEqual(row.eligibility_filter, JSON.stringify([{ field: 'type', operator: 'equals', value: 'Variable' }]));
      assert.strictEqual(row.remote_field_mapping, null);
      assert.strictEqual(row.scan_mode_id, 'sm1');
      assert.strictEqual(Boolean(row.enabled), true);
    });

    it('creates a workflow targeting one existing item', async () => {
      await up(db);

      await db('configuration_workflows').insert({
        id: 'workflow2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        created_by: 'user1',
        updated_by: 'user1',
        south_id: 'south1',
        target_item_id: 'item1',
        discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit, min, max FROM metadata_table' }),
        identity_key_fields: JSON.stringify(['tagName']),
        eligibility_filter: '[]',
        item_field_mapping: JSON.stringify({}),
        remote_field_mapping: JSON.stringify({ unit: '{{unit}}' }),
        scan_mode_id: null,
        enabled: true
      });

      const row = await db('configuration_workflows').where('id', 'workflow2').first();
      assert.strictEqual(row.target_item_id, 'item1');
      assert.strictEqual(row.scan_mode_id, null);
    });

    it('creates a remote-metadata-only workflow (item_field_mapping is null — never touches items)', async () => {
      await up(db);

      await db('configuration_workflows').insert({
        id: 'workflow-metadata-only',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        target_item_id: 'item1',
        discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit FROM metadata_table' }),
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: null,
        remote_field_mapping: JSON.stringify({ unit: '{{unit}}' })
      });

      const row = await db('configuration_workflows').where('id', 'workflow-metadata-only').first();
      assert.strictEqual(row.item_field_mapping, null);
      assert.strictEqual(row.remote_field_mapping, JSON.stringify({ unit: '{{unit}}' }));
    });

    it('defaults enabled to true', async () => {
      await up(db);

      await db('configuration_workflows').insert({
        id: 'workflow3',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: '{}',
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: '{}'
      });

      const row = await db('configuration_workflows').where('id', 'workflow3').first();
      assert.strictEqual(Boolean(row.enabled), true);
    });

    it('cascades: deleting the target item deletes the workflow that targets it', async () => {
      await up(db);
      await db('configuration_workflows').insert({
        id: 'workflow4',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        target_item_id: 'item1',
        discovery_scope: '{}',
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: '{}'
      });

      await db('south_items').where('id', 'item1').delete();

      const row = await db('configuration_workflows').where('id', 'workflow4').first();
      assert.strictEqual(row, undefined);
    });

    it('cascades: deleting the south connector deletes its workflows', async () => {
      await up(db);
      await db('configuration_workflows').insert({
        id: 'workflow5',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: '{}',
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: '{}'
      });

      // south_items itself has an (unrelated, pre-existing) FK to south_connectors with no cascade —
      // clear it first so this delete isn't blocked by that, independent of my own table's FK.
      await db('south_items').where('id', 'item1').delete();
      await db('south_connectors').where('id', 'south1').delete();

      const row = await db('configuration_workflows').where('id', 'workflow5').first();
      assert.strictEqual(row, undefined);
    });

    it('sets scan_mode_id to null instead of failing when the scan mode is deleted', async () => {
      await up(db);
      await db('configuration_workflows').insert({
        id: 'workflow6',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        scan_mode_id: 'sm1',
        discovery_scope: '{}',
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: '{}'
      });

      // south_items itself has an (unrelated, pre-existing) FK to scan_modes with no cascade — clear
      // it first so this delete isn't blocked by that, independent of my own table's FK.
      await db('south_items').where('id', 'item1').delete();
      await db('scan_modes').where('id', 'sm1').delete();

      const row = await db('configuration_workflows').where('id', 'workflow6').first();
      assert.strictEqual(row.scan_mode_id, null);
    });
  });

  describe('down', () => {
    it('drops the configuration_workflows table', async () => {
      await up(db);
      await down(db);

      const table = await db('sqlite_master').where({ type: 'table', name: 'configuration_workflows' }).first();
      assert.strictEqual(table, undefined);
    });
  });
});
