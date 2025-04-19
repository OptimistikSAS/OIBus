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
  await updateNorthConnectors(knex);
  await updateHistoryQueries(knex);
}

async function createTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(TRANSFORMERS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.string('name').notNullable().unique();
    table.string('description');
    table.string('type').notNullable();
    table.string('input_type').notNullable();
    table.string('output_type').notNullable();
    table.string('custom_manifest');
    table.string('custom_code');
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.unique(['north_id', 'transformer_id']);
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_QUERY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.string('options');
    table.unique(['history_id', 'transformer_id']);
  });
}

async function updateNorthConnectors(knex: Knex): Promise<void> {
  await knex.schema.alterTable(NORTH_CONNECTORS_TABLE, table => {
    table.string('unknown_transformer_id');
    table.string('time_values_transformer_id');
  });

  await knex(NORTH_CONNECTORS_TABLE)
    .update({
      unknown_transformer_id: 'iso',
      time_values_transformer_id: 'time-values-to-csv'
    })
    .whereIn('type', ['aws-s3', 'azure-blob', 'file-writer', 'rest', 'sftp']);
  await knex(NORTH_CONNECTORS_TABLE)
    .update({
      unknown_transformer_id: 'iso',
      time_values_transformer_id: 'iso-time-values'
    })
    .whereIn('type', ['console', 'oianalytics']);
}

async function updateHistoryQueries(knex: Knex): Promise<void> {
  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.string('unknown_transformer_id');
    table.string('time_values_transformer_id');
  });

  await knex(HISTORY_QUERIES_TABLE)
    .update({
      unknown_transformer_id: 'iso',
      time_values_transformer_id: 'time-values-to-csv'
    })
    .whereIn('north_type', ['aws-s3', 'azure-blob', 'file-writer', 'rest', 'sftp']);
  await knex(HISTORY_QUERIES_TABLE)
    .update({
      unknown_transformer_id: 'iso',
      time_values_transformer_id: 'iso-time-values'
    })
    .whereIn('north_type', ['console', 'oianalytics']);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
