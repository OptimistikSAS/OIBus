import { Knex } from 'knex';
import path from 'node:path';
import { filesExists } from '../../service/utils';
import fs from 'node:fs/promises';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const EXTERNAL_SOURCES_TABLE = 'external_sources';
const EXTERNAL_SUBSCRIPTION_TABLE = 'external_subscription';
const HISTORY_TRANSFORMERS_TABLE = 'history_transformers';
const SOUTH_TRANSFORMERS_TABLE = 'south_transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const TRANSFORMERS_TABLE = 'transformers';
const NORTH_ITEMS_TABLE = 'north_items';

export async function up(knex: Knex): Promise<void> {
  await removeNorthOIBusConnectors(knex);
  await removeNorthOIBusHistoryQueries(knex);
  await removeExternalSubscriptions(knex);
  await updateSouthConnectorsTable(knex);
  await updateHistoryQueriesTable(knex);
  await createNorthItemsTable(knex);
  await createTransformersTable(knex);
  await createNorthTransformersTable(knex);
  await createSouthTransformersTable(knex);
  await createHistoryTransformersTable(knex);
}

async function removeNorthOIBusConnectors(knex: Knex): Promise<void> {
  const northConnectors: Array<{ id: string; name: string }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'name')
    .where('type', 'oibus');
  await knex(NORTH_CONNECTORS_TABLE).delete().where('type', 'oibus');
  for (const north of northConnectors) {
    const baseFolder = path.resolve('./cache/data-stream', `north-${north.id}`);
    if (await filesExists(baseFolder)) {
      await fs.rm(baseFolder, { recursive: true });
    }
  }
}

async function removeNorthOIBusHistoryQueries(knex: Knex): Promise<void> {
  const historyQueries: Array<{ id: string; name: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'name')
    .where('north_type', 'oibus');

  for (const history of historyQueries) {
    await knex(HISTORY_ITEMS_TABLE).delete().where('history_id', history.id);
    const baseFolder = path.resolve('./cache/history-query', `history-${history.id}`);
    if (await filesExists(baseFolder)) {
      await fs.rm(baseFolder, { recursive: true });
    }
  }
  await knex(HISTORY_QUERIES_TABLE).delete().where('north_type', 'oibus');
}

async function removeExternalSubscriptions(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(EXTERNAL_SUBSCRIPTION_TABLE);
  await knex.schema.dropTableIfExists(EXTERNAL_SOURCES_TABLE);
}

async function updateSouthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_CONNECTORS_TABLE, table => {
    table.boolean('shared_connection').defaultTo(false);
  });
}

async function updateHistoryQueriesTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.boolean('south_shared_connection').defaultTo(false);
  });
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

export async function down(_knex: Knex): Promise<void> {
  return;
}
