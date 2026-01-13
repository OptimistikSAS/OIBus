import { Knex } from 'knex';

const REGISTRATIONS_TABLE = 'registrations';

export async function up(knex: Knex): Promise<void> {
  await updateRegistrationSettings(knex);
}

async function updateRegistrationSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('use_api_gateway');
    table.string('api_gateway_header_key');
    table.string('api_gateway_header_value');
  });

  await knex(REGISTRATIONS_TABLE).update({
    use_api_gateway: false,
    api_gateway_header_key: '',
    api_gateway_header_value: ''
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
