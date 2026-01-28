import { Knex } from 'knex';

const REGISTRATIONS_TABLE = 'registrations';

export async function up(knex: Knex): Promise<void> {
  await updateRegistrationSettings(knex);
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.string('api_gateway_base_endpoint');
  });

  await knex(REGISTRATIONS_TABLE).update({
    api_gateway_base_endpoint: ''
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
