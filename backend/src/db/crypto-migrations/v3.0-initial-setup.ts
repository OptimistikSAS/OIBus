import { Knex } from 'knex';
import { CRYPTO_TABLE } from '../../repository/crypto.repository';

export async function up(knex: Knex): Promise<void> {
  await createCryptoTable(knex);
}

async function createCryptoTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(CRYPTO_TABLE, table => {
    table.uuid('id').primary();
    table.string('algorithm').notNullable();
    table.string('init_vector').notNullable();
    table.string('security_key').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(CRYPTO_TABLE);
}
