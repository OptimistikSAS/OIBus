import { Knex } from 'knex';
import { OIANALYTICS_MESSAGE_TABLE } from '../../repository/oianalytics-message.repository';

export async function up(knex: Knex): Promise<void> {
  await updateOIAMessageTable(knex);
}

async function updateOIAMessageTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OIANALYTICS_MESSAGE_TABLE, table => {
    table.setNullable('content');
  });
}

export async function down(_knex: Knex): Promise<void> {}
