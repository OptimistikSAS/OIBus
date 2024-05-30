import { Knex } from 'knex';
import { NORTH_ITEMS_TABLE } from '../../repository/north-item.repository';
import { TRANSFORMERS_TABLE } from '../../repository/transformer.repository';
import { NORTH_TRANSFORMERS_TABLE } from '../../repository/north-transformer.repository';
import { SOUTH_TRANSFORMERS_TABLE } from '../../repository/south-transformer.repository';
import { HISTORY_TRANSFORMERS_TABLE } from '../../repository/history-transformer.repository';
import { NORTH_CONNECTORS_TABLE } from '../../repository/north-connector.repository';
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { HISTORY_QUERIES_TABLE } from '../../repository/history-query.repository';

export async function up(knex: Knex): Promise<void> {
  await createNorthItemsTable(knex);
  await createTransformersTable(knex);
  await createNorthTransformersTable(knex);
  await createSouthTransformersTable(knex);
  await createHistoryTransformersTable(knex);
}

async function createNorthItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_ITEMS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.uuid('connector_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.string('name').notNullable();
    table.boolean('enabled').notNullable();
    table.json('settings').notNullable();

    table.unique(['connector_id', 'name']);
  });
}

async function createTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(TRANSFORMERS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.string('name').notNullable().unique();
    table.string('description');
    table.string('input_type').notNullable();
    table.string('output_type').notNullable();
    table.string('code').notNullable();
    table.string('file_regex');
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);

    table.unique(['north_id', 'transformer_id']);
  });
}

async function createSouthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_TRANSFORMERS_TABLE, table => {
    table.uuid('south_id').notNullable().references('id').inTable(SOUTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);

    table.unique(['south_id', 'transformer_id']);
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.enum('connector_type', ['south', 'north']).notNullable();
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);

    table.unique(['history_id', 'connector_type', 'transformer_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(NORTH_ITEMS_TABLE);
  await knex.schema.dropTable(TRANSFORMERS_TABLE);
  await knex.schema.dropTable(NORTH_TRANSFORMERS_TABLE);
  await knex.schema.dropTable(SOUTH_TRANSFORMERS_TABLE);
  await knex.schema.dropTable(HISTORY_TRANSFORMERS_TABLE);
}
