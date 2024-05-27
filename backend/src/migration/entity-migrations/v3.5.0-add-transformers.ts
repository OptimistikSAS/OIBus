import { Knex } from 'knex';
import {
  TRANSFORMERS_TABLE,
  NORTH_TRANSFORMERS_TABLE,
  SOUTH_TRANSFORMERS_TABLE,
  HISTORY_TRANSFORMERS_TABLE
} from '../../repository/transformer.repository';

export async function up(knex: Knex): Promise<void> {
  await createTransformersTable(knex);
  await createNorthTransformersTable(knex);
  await createSouthTransformersTable(knex);
  await createHistoryTransformersTable(knex);
}

async function createTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(TRANSFORMERS_TABLE, table => {
    table.uuid('id').primary();
    table.string('input_type').notNullable();
    table.string('output_type').notNullable();
    table.string('code').notNullable();
    table.string('file_regex').nullable();
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id');
    table.uuid('transformer_id');
  });
}

async function createSouthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_TRANSFORMERS_TABLE, table => {
    table.uuid('south_id');
    table.uuid('transformer_id');
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id');
    table.uuid('north_transformer_id');
    table.uuid('south_transformer_id');
  });
}

export async function down(): Promise<void> {}
