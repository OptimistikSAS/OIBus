import { Knex } from 'knex';
import { REGISTRATIONS_TABLE } from '../../repository/registration.repository';
import CreateTableBuilder = Knex.CreateTableBuilder;

export async function up(knex: Knex): Promise<void> {
  await createRegistrationTable(knex);
}

function createDefaultEntityFields(table: CreateTableBuilder): void {
  table.uuid('id').primary();
  table.timestamps(false, true);
}

async function createRegistrationTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(REGISTRATIONS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('host').notNullable().unique();
    table.string('activation_code').unique();
    table.string('activation_date');
    table.string('activation_expiration_date');
    table.boolean('activated');
    table.boolean('enabled');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(REGISTRATIONS_TABLE);
}
