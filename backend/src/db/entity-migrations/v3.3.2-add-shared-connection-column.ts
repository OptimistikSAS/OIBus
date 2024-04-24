import { Knex } from 'knex';
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';

export async function up(knex: Knex): Promise<void> {
  await updateSouthConnectorsTable(knex);
}

async function updateSouthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_CONNECTORS_TABLE, table => {
    table.boolean('shared_connection').defaultTo(false);
  });
}

export async function down(): Promise<void> {}
