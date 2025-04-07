import { Knex } from 'knex';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

export async function up(knex: Knex): Promise<void> {
  await createTransformersTable(knex);
  await createNorthTransformersTable(knex);
  await createHistoryTransformersTable(knex);
}

async function createTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(TRANSFORMERS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.string('type').notNullable();
    table.string('input_type').notNullable();
    table.string('output_type').notNullable();
    // standard
    table.string('function_name');
    // custom
    table.string('name');
    table.string('description');
    table.string('custom_manifest');
    table.string('custom_code');
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.string('input_type');
    table.unique(['north_id', 'transformer_id', 'input_type']);
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.string('input_type');
    table.unique(['history_id', 'transformer_id', 'input_type']);
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
