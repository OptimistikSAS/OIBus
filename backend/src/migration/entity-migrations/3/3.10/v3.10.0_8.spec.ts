import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_8';

describe('Entity migration v3.10.0_8', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.raw('PRAGMA foreign_keys = ON');
    await buildPreMigrationSchema(db, 'v3.10.0_8');

    await db('south_connectors').insert({
      id: 'south1',
      name: 'South 1',
      type: 'mssql',
      enabled: true,
      settings: JSON.stringify({})
    });
    await db('configuration_workflows').insert({
      id: 'workflow1',
      name: 'workflow1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      south_id: 'south1',
      discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit FROM metadata_table' }),
      identity_key_fields: JSON.stringify(['tagName']),
      eligibility_filter: '[]',
      push_to_oi_analytics: true
    });
    await db('workflow_runs').insert({
      id: 'run1',
      workflow_id: 'workflow1',
      trigger_type: 'manual',
      status: 'RUNNING',
      started_at: '2026-01-01T00:00:00.000Z'
    });
  });

  describe('up', () => {
    it('records a configuration-workflow-result message with its run and payload', async () => {
      await up(db);

      const payload = JSON.stringify({ southId: 'south1', workflowId: 'workflow1', records: [{ tagName: 'a', unit: 'C' }] });
      await db('oianalytics_messages').insert({
        id: 'message1',
        type: 'configuration-workflow-result',
        status: 'PENDING',
        created_by: 'system',
        updated_by: 'system',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        workflow_run_id: 'run1',
        payload
      });

      const row = await db('oianalytics_messages').where('id', 'message1').first();
      assert.strictEqual(row.workflow_run_id, 'run1');
      assert.strictEqual(row.payload, payload);
    });

    it('leaves both columns null by default (an unrelated full-config/history-queries message)', async () => {
      await up(db);

      await db('oianalytics_messages').insert({
        id: 'message2',
        type: 'full-config',
        status: 'PENDING',
        created_by: 'system',
        updated_by: 'system',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      });

      const row = await db('oianalytics_messages').where('id', 'message2').first();
      assert.strictEqual(row.workflow_run_id, null);
      assert.strictEqual(row.payload, null);
    });

    it('cascades: deleting the run deletes its message', async () => {
      await up(db);
      await db('oianalytics_messages').insert({
        id: 'message1',
        type: 'configuration-workflow-result',
        status: 'PENDING',
        created_by: 'system',
        updated_by: 'system',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        workflow_run_id: 'run1',
        payload: '{}'
      });

      await db('workflow_runs').where('id', 'run1').delete();

      const row = await db('oianalytics_messages').where('id', 'message1').first();
      assert.strictEqual(row, undefined);
    });
  });

  describe('down', () => {
    it('removes both columns from oianalytics_messages', async () => {
      await up(db);
      await down(db);

      const cols = (await db.raw('PRAGMA table_info(oianalytics_messages)')) as Array<{ name: string }>;
      const names = cols.map(c => c.name);
      assert.ok(!names.includes('workflow_run_id'));
      assert.ok(!names.includes('payload'));
    });
  });
});
