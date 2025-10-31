import { Knex } from 'knex';

const LOG_TABLE = 'logs';

export async function up(knex: Knex): Promise<void> {
  await createLogsTable(knex);
}

async function createLogsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(LOG_TABLE, table => {
    table.datetime('timestamp').notNullable();
    table.string('level').notNullable();
    table.string('scope_type').notNullable();
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });
}

export async function down(): Promise<void> {
  return;
}
