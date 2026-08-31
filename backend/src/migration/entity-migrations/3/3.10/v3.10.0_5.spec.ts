import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_5';

describe('Entity migration v3.10.0_5', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.raw('PRAGMA foreign_keys = ON');
    await buildPreMigrationSchema(db, 'v3.10.0_5');

    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
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
  });

  describe('up', () => {
    it('lets an item be owned by a workflow', async () => {
      await up(db);

      await db('south_items').insert({
        id: 'item1',
        connector_id: 'south1',
        scan_mode_id: 'sm1',
        name: 'item1',
        enabled: true,
        settings: JSON.stringify({}),
        created_by_workflow_id: 'workflow1'
      });

      const row = await db('south_items').where('id', 'item1').first();
      assert.strictEqual(row.created_by_workflow_id, 'workflow1');
      assert.strictEqual(row.disabled_reason, null);
    });

    it('lets an item be flagged with a disabled_reason', async () => {
      await up(db);

      await db('south_items').insert({
        id: 'item2',
        connector_id: 'south1',
        scan_mode_id: 'sm1',
        name: 'item2',
        enabled: false,
        settings: JSON.stringify({}),
        disabled_reason: 'No longer found by workflow "workflow1" discovery'
      });

      const row = await db('south_items').where('id', 'item2').first();
      assert.strictEqual(row.disabled_reason, 'No longer found by workflow "workflow1" discovery');
    });

    it('leaves both columns null by default (an item not owned by any workflow)', async () => {
      await up(db);

      await db('south_items').insert({
        id: 'item3',
        connector_id: 'south1',
        scan_mode_id: 'sm1',
        name: 'item3',
        enabled: true,
        settings: JSON.stringify({})
      });

      const row = await db('south_items').where('id', 'item3').first();
      assert.strictEqual(row.created_by_workflow_id, null);
      assert.strictEqual(row.disabled_reason, null);
    });

    it('clears created_by_workflow_id instead of failing when the owning workflow is deleted', async () => {
      await up(db);
      await db('south_items').insert({
        id: 'item4',
        connector_id: 'south1',
        scan_mode_id: 'sm1',
        name: 'item4',
        enabled: true,
        settings: JSON.stringify({}),
        created_by_workflow_id: 'workflow1'
      });

      await db('configuration_workflows').where('id', 'workflow1').delete();

      const row = await db('south_items').where('id', 'item4').first();
      assert.strictEqual(row.created_by_workflow_id, null);
      // the item itself survives — only the ownership link is cleared
      assert.strictEqual(row.name, 'item4');
    });
  });

  describe('down', () => {
    it('removes both columns from south_items', async () => {
      await up(db);
      await down(db);

      const cols = (await db.raw('PRAGMA table_info(south_items)')) as Array<{ name: string }>;
      const names = cols.map(c => c.name);
      assert.ok(!names.includes('created_by_workflow_id'));
      assert.ok(!names.includes('disabled_reason'));
    });
  });
});
