import { Knex } from 'knex';

const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const COMMANDS_TABLE = 'commands';
const REGISTRATIONS_TABLE = 'registrations';

export async function up(knex: Knex): Promise<void> {
  await updateOIAMessageTable(knex);
  await updateOIACommandTable(knex);
  await updateRegistrationSettings(knex);
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.string('history_id');
  });
}

async function updateOIACommandTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(COMMANDS_TABLE, table => {
    table.string('certificate_id');
    table.string('ip_filter_id');
    table.string('history_id');
    table.string('item_id');
  });
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('command_test_south_connection');
    table.boolean('command_test_south_item');
    table.boolean('command_test_north_connection');
    table.boolean('command_test_history_north_connection');
    table.boolean('command_test_history_south_connection');
    table.boolean('command_test_history_south_item');
  });
  await knex(REGISTRATIONS_TABLE).update({
    command_test_south_connection: true,
    command_test_south_item: true,
    command_test_north_connection: true,
    command_test_history_south_connection: true,
    command_test_history_south_item: true,
    command_test_history_north_connection: true
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
