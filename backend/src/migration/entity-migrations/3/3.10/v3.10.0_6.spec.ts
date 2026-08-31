import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_6';

describe('Entity migration v3.10.0_6', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.raw('PRAGMA foreign_keys = ON');
    await buildPreMigrationSchema(db, 'v3.10.0_6');

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
    it('creates a running row with counts defaulted to 0', async () => {
      await up(db);

      await db('workflow_runs').insert({
        id: 'run1',
        workflow_id: 'workflow1',
        trigger_type: 'manual',
        status: 'RUNNING',
        started_at: '2026-01-01T00:00:00.000Z',
        triggered_by: 'user1'
      });

      const row = await db('workflow_runs').where('id', 'run1').first();
      assert.strictEqual(row.status, 'RUNNING');
      assert.strictEqual(row.completed_at, null);
      assert.strictEqual(row.discovered_count, 0);
      assert.strictEqual(row.eligible_count, 0);
      assert.strictEqual(row.created_count, 0);
      assert.strictEqual(row.updated_count, 0);
      assert.strictEqual(row.disabled_count, 0);
      assert.strictEqual(row.pushed_count, 0);
      assert.strictEqual(row.error, null);
      assert.strictEqual(row.triggered_by, 'user1');
    });

    it('records a completed scheduled run with full counts and no triggered_by', async () => {
      await up(db);

      await db('workflow_runs').insert({
        id: 'run2',
        workflow_id: 'workflow1',
        trigger_type: 'scheduled',
        status: 'COMPLETED',
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:00:05.000Z',
        discovered_count: 120,
        eligible_count: 45,
        created_count: 3,
        updated_count: 2,
        disabled_count: 1,
        pushed_count: 5,
        triggered_by: null
      });

      const row = await db('workflow_runs').where('id', 'run2').first();
      assert.strictEqual(row.trigger_type, 'scheduled');
      assert.strictEqual(row.triggered_by, null);
      assert.strictEqual(row.discovered_count, 120);
      assert.strictEqual(row.eligible_count, 45);
      assert.strictEqual(row.created_count, 3);
      assert.strictEqual(row.updated_count, 2);
      assert.strictEqual(row.disabled_count, 1);
      assert.strictEqual(row.pushed_count, 5);
    });

    it('records an errored run with a partial count and an error message', async () => {
      await up(db);

      await db('workflow_runs').insert({
        id: 'run3',
        workflow_id: 'workflow1',
        trigger_type: 'manual',
        status: 'ERRORED',
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:00:02.000Z',
        discovered_count: 10,
        error: 'OPCUA explore session expired, please restart the exploration',
        triggered_by: 'user1'
      });

      const row = await db('workflow_runs').where('id', 'run3').first();
      assert.strictEqual(row.status, 'ERRORED');
      assert.strictEqual(row.discovered_count, 10);
      assert.strictEqual(row.eligible_count, 0);
      assert.strictEqual(row.error, 'OPCUA explore session expired, please restart the exploration');
    });

    it('cascades: deleting the workflow deletes its run history', async () => {
      await up(db);
      await db('workflow_runs').insert({
        id: 'run4',
        workflow_id: 'workflow1',
        trigger_type: 'manual',
        status: 'RUNNING',
        started_at: '2026-01-01T00:00:00.000Z'
      });

      await db('configuration_workflows').where('id', 'workflow1').delete();

      const row = await db('workflow_runs').where('id', 'run4').first();
      assert.strictEqual(row, undefined);
    });
  });

  describe('down', () => {
    it('drops the workflow_runs table', async () => {
      await up(db);
      await down(db);

      const table = await db('sqlite_master').where({ type: 'table', name: 'workflow_runs' }).first();
      assert.strictEqual(table, undefined);
    });
  });
});
