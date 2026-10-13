import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_1';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.10.0_1', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_1.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  const CONFIGURATION_PERMISSIONS = {
    command_update_engine_settings: true,
    command_create_scan_mode: true,
    command_update_scan_mode: true,
    command_delete_scan_mode: true,
    command_create_ip_filter: true,
    command_update_ip_filter: true,
    command_delete_ip_filter: true,
    command_create_certificate: true,
    command_update_certificate: true,
    command_delete_certificate: true,
    command_create_south: true,
    command_update_south: true,
    command_delete_south: true,
    command_create_or_update_south_items_from_csv: true,
    command_create_north: true,
    command_update_north: true,
    command_delete_north: true,
    command_create_history_query: true,
    command_update_history_query: true,
    command_delete_history_query: true,
    command_create_or_update_history_items_from_csv: true,
    command_create_custom_transformer: true,
    command_update_custom_transformer: true,
    command_delete_custom_transformer: true
  };

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  async function importConfigurationAfterMigration(permissions: Record<string, boolean | null>): Promise<number> {
    await db('registrations').insert({ id: 'registration-id', host: 'http://localhost:4200', status: 'REGISTERED', ...permissions });
    await up(db);
    return (await db('registrations').where('id', 'registration-id').first()).command_import_configuration;
  }

  it('should add the new permissions', async () => {
    await up(db);

    const columns = await columnNames(db, 'registrations');
    assert.ok(columns.includes('command_import_configuration'));
    assert.ok(columns.includes('command_dump_memory'));
    assert.ok(columns.includes('command_retrieve_logs_database'));
  });

  it('should grant the dump-memory and retrieve-logs-database permissions', async () => {
    await db('registrations').insert({ id: 'registration-id', host: 'http://localhost:4200', status: 'REGISTERED' });

    await up(db);

    const registration = await db('registrations').where('id', 'registration-id').first();
    assert.strictEqual(registration.command_dump_memory, 1);
    assert.strictEqual(registration.command_retrieve_logs_database, 1);
  });

  it('should grant the import-configuration permission when every configuration permission is granted', async () => {
    assert.strictEqual(
      await importConfigurationAfterMigration({
        ...CONFIGURATION_PERMISSIONS,
        // not changing the configuration
        command_update_version: false,
        command_update_registration_settings: false,
        command_test_south_connection: false,
        command_setpoint: false,
        command_update_north_cache_content: false
      }),
      1
    );
  });

  for (const permission of Object.keys(CONFIGURATION_PERMISSIONS)) {
    it(`should not grant the import-configuration permission when ${permission} is not granted`, async () => {
      assert.strictEqual(await importConfigurationAfterMigration({ ...CONFIGURATION_PERMISSIONS, [permission]: false }), 0);
    });
  }

  it('should not grant the import-configuration permission when a configuration permission is not set', async () => {
    assert.strictEqual(await importConfigurationAfterMigration({ ...CONFIGURATION_PERMISSIONS, command_create_south: null }), 0);
  });

  it('should remove the new permissions', async () => {
    await up(db);
    await down(db);

    const columns = await columnNames(db, 'registrations');
    assert.ok(!columns.includes('command_import_configuration'));
    assert.ok(!columns.includes('command_dump_memory'));
    assert.ok(!columns.includes('command_retrieve_logs_database'));
  });
});
