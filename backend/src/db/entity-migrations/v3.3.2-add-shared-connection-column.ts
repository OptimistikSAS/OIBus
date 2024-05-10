import { Knex } from 'knex';
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { HISTORY_QUERIES_TABLE } from '../../repository/history-query.repository';

export async function up(knex: Knex): Promise<void> {
  await updateSouthConnectorsTable(knex);
  await updateHistoryQueriesTable(knex);
}

async function updateSouthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_CONNECTORS_TABLE, table => {
    table.boolean('shared_connection').defaultTo(false);
  });
}

async function updateHistoryQueriesTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.boolean('south_shared_connection').defaultTo(false);
  });
}

export async function down(): Promise<void> {}
