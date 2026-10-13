import { Knex } from 'knex';

const REGISTRATIONS_TABLE = 'registrations';

/**
 * The permissions of the commands changing the configuration that the import-configuration command replaces. Registration
 * settings are not part of it (an import never changes the registration).
 */
const CONFIGURATION_PERMISSION_COLUMNS = [
  'command_update_engine_settings',
  'command_create_scan_mode',
  'command_update_scan_mode',
  'command_delete_scan_mode',
  'command_create_ip_filter',
  'command_update_ip_filter',
  'command_delete_ip_filter',
  'command_create_certificate',
  'command_update_certificate',
  'command_delete_certificate',
  'command_create_south',
  'command_update_south',
  'command_delete_south',
  'command_create_or_update_south_items_from_csv',
  'command_create_north',
  'command_update_north',
  'command_delete_north',
  'command_create_history_query',
  'command_update_history_query',
  'command_delete_history_query',
  'command_create_or_update_history_items_from_csv',
  'command_create_custom_transformer',
  'command_update_custom_transformer',
  'command_delete_custom_transformer'
];

/**
 * Adds the permission of the import-configuration remote command. As importing a configuration replaces the whole
 * configuration, it is only granted on a registration granting every permission changing the configuration: an OIBus
 * forbidding any of them must not be fully reconfigured by a single command.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_import_configuration');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_import_configuration: knex.raw(
      `CASE WHEN ${CONFIGURATION_PERMISSION_COLUMNS.map(column => `${column} = 1`).join(' AND ')} THEN 1 ELSE 0 END`
    )
  });
}

export async function down(knex: Knex): Promise<void> {
  // native SQLite DROP COLUMN, like v3.10.0.ts, instead of the table rebuild of knex dropColumn
  await knex.raw(`ALTER TABLE ${REGISTRATIONS_TABLE} DROP COLUMN command_import_configuration`);
}
