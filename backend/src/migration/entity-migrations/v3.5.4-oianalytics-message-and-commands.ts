import { Knex } from 'knex';

const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const COMMANDS_TABLE = 'commands';

export async function up(knex: Knex): Promise<void> {
  await updateOIAMessageTable(knex);
  await updateOIACommandTable(knex);
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.string('history_id');
  });
}

async function updateOIACommandTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(COMMANDS_TABLE, _table => {
    // table.string('history_id');
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
