import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_7';

describe('Entity migration v3.10.0_7', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.raw('PRAGMA foreign_keys = ON');
    await buildPreMigrationSchema(db, 'v3.10.0_7');

    await db('south_connectors').insert({
      id: 'south1',
      name: 'South 1',
      type: 'opcua',
      enabled: true,
      settings: JSON.stringify({})
    });
    await db('configuration_workflows').insert({
      id: 'workflow1',
      name: 'workflow1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      south_id: 'south1',
      discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
      identity_key_fields: JSON.stringify(['nodeId']),
      eligibility_filter: '[]',
      item_field_mapping: JSON.stringify({ name: '{{name}}' })
    });
    await db('south_items').insert([
      { id: 'item1', connector_id: 'south1', name: 'item1', enabled: true, settings: JSON.stringify({}) },
      { id: 'item2', connector_id: 'south1', name: 'item2', enabled: true, settings: JSON.stringify({}) }
    ]);
  });

  describe('up', () => {
    it('records a point for a discovered entry', async () => {
      await up(db);

      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: JSON.stringify({ nodeId: 'ns=1;s=Temperature', type: 'Variable' })
      });

      const row = await db('item_point_metadata').where('id', 'point1').first();
      assert.strictEqual(row.south_item_id, 'item1');
      assert.strictEqual(row.discovered_metadata, JSON.stringify({ nodeId: 'ns=1;s=Temperature', type: 'Variable' }));
      assert.strictEqual(row.status, 'active');
      assert.strictEqual(row.orphaned_at, null);
    });

    it('rejects a second point with the same (workflow_id, discovered_entry_key) — the diff lookup must stay unique', async () => {
      await up(db);
      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: '{}'
      });

      await assert.rejects(
        db('item_point_metadata').insert({
          id: 'point2',
          workflow_id: 'workflow1',
          south_item_id: 'item2',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: '{}'
        }),
        /UNIQUE constraint failed/
      );
    });

    it('allows the same discovered_entry_key across two different workflows', async () => {
      await up(db);
      await db('configuration_workflows').insert({
        id: 'workflow2',
        name: 'workflow2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: '{}',
        identity_key_fields: '[]',
        eligibility_filter: '[]',
        item_field_mapping: JSON.stringify({})
      });

      await db('item_point_metadata').insert([
        { id: 'point1', workflow_id: 'workflow1', south_item_id: 'item1', discovered_entry_key: 'sameKey', discovered_metadata: '{}' },
        { id: 'point2', workflow_id: 'workflow2', south_item_id: 'item1', discovered_entry_key: 'sameKey', discovered_metadata: '{}' }
      ]);

      const rows = await db('item_point_metadata').where('discovered_entry_key', 'sameKey');
      assert.strictEqual(rows.length, 2);
    });

    it('marks a point orphaned without deleting it', async () => {
      await up(db);
      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: '{}'
      });

      await db('item_point_metadata').where('id', 'point1').update({ status: 'orphaned', orphaned_at: '2026-01-02T00:00:00.000Z' });

      const row = await db('item_point_metadata').where('id', 'point1').first();
      assert.strictEqual(row.status, 'orphaned');
      assert.strictEqual(row.orphaned_at, '2026-01-02T00:00:00.000Z');
    });

    it('cascades: deleting the item deletes its points', async () => {
      await up(db);
      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: '{}'
      });

      await db('south_items').where('id', 'item1').delete();

      const row = await db('item_point_metadata').where('id', 'point1').first();
      assert.strictEqual(row, undefined);
    });

    it('cascades: deleting the workflow deletes its points', async () => {
      await up(db);
      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: '{}'
      });

      await db('configuration_workflows').where('id', 'workflow1').delete();

      const row = await db('item_point_metadata').where('id', 'point1').first();
      assert.strictEqual(row, undefined);
    });
  });

  describe('down', () => {
    it('drops the item_point_metadata table', async () => {
      await up(db);
      await down(db);

      const table = await db('sqlite_master').where({ type: 'table', name: 'item_point_metadata' }).first();
      assert.strictEqual(table, undefined);
    });
  });
});
