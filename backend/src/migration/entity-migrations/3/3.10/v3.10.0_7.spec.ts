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
      type: 'mssql',
      enabled: true,
      settings: JSON.stringify({})
    });
    await db('configuration_workflows').insert({
      id: 'workflow1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      south_id: 'south1',
      discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit, min, max FROM metadata_table' }),
      identity_key_fields: JSON.stringify(['tagName']),
      eligibility_filter: '[]',
      remote_field_mapping: JSON.stringify({ unit: '{{unit}}' })
    });
    await db('south_items').insert([
      { id: 'item1', connector_id: 'south1', name: 'query item', enabled: true, settings: JSON.stringify({}) },
      { id: 'item2', connector_id: 'south1', name: 'leaf item 2', enabled: true, settings: JSON.stringify({}) },
      { id: 'item3', connector_id: 'south1', name: 'leaf item 3', enabled: true, settings: JSON.stringify({}) }
    ]);
  });

  describe('up', () => {
    it('records a 1:1 point (a single item, one point)', async () => {
      await up(db);

      await db('item_point_metadata').insert({
        id: 'point1',
        workflow_id: 'workflow1',
        south_item_id: 'item1',
        discovered_entry_key: 'ns=1;s=Temperature',
        discovered_metadata: JSON.stringify({ nodeId: 'ns=1;s=Temperature', type: 'Variable' }),
        description: 'Reactor temperature',
        unit: '°C',
        min_acceptable_value: -20,
        max_acceptable_value: 120
      });

      const row = await db('item_point_metadata').where('id', 'point1').first();
      assert.strictEqual(row.south_item_id, 'item1');
      assert.strictEqual(row.unit, '°C');
      assert.strictEqual(row.min_acceptable_value, -20);
      assert.strictEqual(row.max_acceptable_value, 120);
      assert.strictEqual(row.status, 'active');
      assert.strictEqual(row.orphaned_at, null);
      assert.strictEqual(row.last_pushed_at, null);
    });

    it('records N:1 points (one SQL item, several columns) sharing the same south_item_id', async () => {
      await up(db);

      await db('item_point_metadata').insert([
        {
          id: 'point-col-a',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'columnA',
          discovered_metadata: JSON.stringify({ tagName: 'columnA', unit: 'bar' })
        },
        {
          id: 'point-col-b',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'columnB',
          discovered_metadata: JSON.stringify({ tagName: 'columnB', unit: 'C' })
        }
      ]);

      const rows = await db('item_point_metadata').where('south_item_id', 'item1').orderBy('id');
      assert.strictEqual(rows.length, 2);
      assert.ok(rows.every(row => row.south_item_id === 'item1'));
      assert.notStrictEqual(rows[0].discovered_entry_key, rows[1].discovered_entry_key);
    });

    it('records 1:N points (multi-item discovery) each with their own south_item_id, sharing workflow_id', async () => {
      await up(db);

      await db('item_point_metadata').insert([
        {
          id: 'point-leaf-2',
          workflow_id: 'workflow1',
          south_item_id: 'item2',
          discovered_entry_key: 'ns=1;s=Leaf2',
          discovered_metadata: JSON.stringify({ nodeId: 'ns=1;s=Leaf2' })
        },
        {
          id: 'point-leaf-3',
          workflow_id: 'workflow1',
          south_item_id: 'item3',
          discovered_entry_key: 'ns=1;s=Leaf3',
          discovered_metadata: JSON.stringify({ nodeId: 'ns=1;s=Leaf3' })
        }
      ]);

      const rows = await db('item_point_metadata').where('workflow_id', 'workflow1').orderBy('id');
      assert.strictEqual(rows.length, 2);
      assert.notStrictEqual(rows[0].south_item_id, rows[1].south_item_id);
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
