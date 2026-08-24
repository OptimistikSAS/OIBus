import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_3';

describe('Entity migration v3.10.0_3', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_3');

    await db('engines').insert({
      id: 'test-engine-id',
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
      oibus_version: '3.9.0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  });

  describe('up', () => {
    it('creates the audit_logs table with the expected columns', async () => {
      await up(db);

      await db('audit_logs').insert({
        id: 'audit1',
        entity_type: 'south_connector',
        entity_id: 'south1',
        action: 'CREATE',
        previous_state: null,
        new_state: JSON.stringify({ name: 'South 1' }),
        user_id: 'user1',
        created_at: '2026-01-01T00:00:00.000Z'
      });
      const row = await db('audit_logs').where('id', 'audit1').first();
      assert.strictEqual(row.entity_type, 'south_connector');
      assert.strictEqual(row.entity_id, 'south1');
      assert.strictEqual(row.action, 'CREATE');
      assert.strictEqual(row.previous_state, null);
      assert.strictEqual(row.new_state, JSON.stringify({ name: 'South 1' }));
      assert.strictEqual(row.user_id, 'user1');
      assert.strictEqual(row.created_at, '2026-01-01T00:00:00.000Z');

      await db('audit_logs').insert({
        id: 'audit2',
        entity_type: 'south_connector',
        entity_id: 'south1',
        action: 'DELETE',
        previous_state: JSON.stringify({ name: 'South 1' }),
        new_state: null,
        user_id: 'user1',
        created_at: '2026-01-02T00:00:00.000Z'
      });
      const row2 = await db('audit_logs').where('id', 'audit2').first();
      assert.strictEqual(row2.previous_state, JSON.stringify({ name: 'South 1' }));
      assert.strictEqual(row2.new_state, null);
    });

    it('adds audit_retention_duration to engines and backfills it to 90', async () => {
      await up(db);

      const engine = await db('engines').where('id', 'test-engine-id').first();
      assert.strictEqual(engine.audit_retention_duration, 90);
    });
  });

  describe('down', () => {
    it('drops the audit_logs table', async () => {
      await up(db);
      await down(db);

      const table = await db('sqlite_master').where({ type: 'table', name: 'audit_logs' }).first();
      assert.strictEqual(table, undefined);
    });

    it('removes the audit_retention_duration column from engines', async () => {
      await up(db);
      await down(db);

      const cols = (await db.raw('PRAGMA table_info(engines)')) as Array<{ name: string }>;
      assert.ok(!cols.map(c => c.name).includes('audit_retention_duration'));
    });
  });
});
