import { Knex } from 'knex';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';

export async function up(knex: Knex): Promise<void> {
  await updateSouthConnectorsTable(knex);
}

async function updateSouthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE ${SOUTH_CONNECTORS_TABLE} ADD history_read_overlap NOT NULL DEFAULT 0`);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
