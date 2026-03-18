import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const IP_FILTERS_TABLE = 'ip_filters';
const SCAN_MODES_TABLE = 'scan_modes';

export async function up(knex: Knex): Promise<void> {
  await updateNullDescriptions(knex);
}

async function updateNullDescriptions(knex: Knex): Promise<void> {
  for (const table of [SOUTH_CONNECTORS_TABLE, NORTH_CONNECTORS_TABLE, HISTORY_QUERIES_TABLE, IP_FILTERS_TABLE, SCAN_MODES_TABLE]) {
    await knex(table).where('description', null).update({ description: '' });
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
