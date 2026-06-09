import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.string('proxy_username').nullable();
    table.string('proxy_password').nullable();
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
