import { Knex } from 'knex';

const TRANSFORMERS_TABLE = 'transformers';

export async function up(knex: Knex): Promise<void> {
  await updateTransformersTable(knex);
}

async function updateTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TRANSFORMERS_TABLE, table => {
    table.string('language');
  });

  await knex(TRANSFORMERS_TABLE).update({ language: 'javascript' }).where('type', 'custom');
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
