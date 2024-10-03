import { Knex } from 'knex';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const NORTH_ITEMS_TABLE = 'north_items';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_SOUTH_ITEMS_TABLE = 'history_south_items';
const HISTORY_NORTH_ITEMS_TABLE = 'history_north_items';
const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const SOUTH_TRANSFORMERS_TABLE = 'south_transformers';
const HISTORY_TRANSFORMERS_TABLE = 'history_transformers';

export async function up(knex: Knex): Promise<void> {
  await createNorthItemsTable(knex);
  await createNorthHistoryItemsTable(knex);
  await renameSouthHistoryItemsTable(knex);
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

async function createNorthHistoryItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_NORTH_ITEMS_TABLE, table => {
    table.uuid('id').primary();
    table.timestamps(false, true);
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.string('name').notNullable();
    table.boolean('enabled').notNullable();
    table.json('settings').notNullable();

    table.unique(['history_id', 'name']);
  });
}

async function renameSouthHistoryItemsTable(knex: Knex): Promise<void> {
  await knex.schema.renameTable('history_items', HISTORY_SOUTH_ITEMS_TABLE);
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
  });
}

async function createNorthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_TRANSFORMERS_TABLE, table => {
    table.uuid('north_id').notNullable().references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.integer('transformer_order').notNullable();

    table.unique(['north_id', 'transformer_id']);
  });
}

async function createSouthTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_TRANSFORMERS_TABLE, table => {
    table.uuid('south_id').notNullable().references('id').inTable(SOUTH_CONNECTORS_TABLE);
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.integer('transformer_order').notNullable();

    table.unique(['south_id', 'transformer_id']);
  });
}

async function createHistoryTransformersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_TRANSFORMERS_TABLE, table => {
    table.uuid('history_id').notNullable().references('id').inTable(HISTORY_QUERIES_TABLE);
    table.enum('connector_type', ['south', 'north']).notNullable();
    table.uuid('transformer_id').notNullable().references('id').inTable(TRANSFORMERS_TABLE);
    table.integer('transformer_order').notNullable();

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
