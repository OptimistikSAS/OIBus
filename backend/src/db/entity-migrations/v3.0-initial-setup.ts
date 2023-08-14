import { Knex } from 'knex';
import { LOG_LEVELS } from '../../../../shared/model/engine.model';
import { ENGINES_TABLE } from '../../repository/engine.repository';
import { USERS_TABLE } from '../../repository/user.repository';
import { EXTERNAL_SOURCES_TABLE } from '../../repository/external-source.repository';
import { IP_FILTERS_TABLE } from '../../repository/ip-filter.repository';
import { SCAN_MODES_TABLE } from '../../repository/scan-mode.repository';
import { HISTORY_QUERIES_TABLE } from '../../repository/history-query.repository';
import { HISTORY_ITEMS_TABLE } from '../../repository/history-query-item.repository';
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { SOUTH_ITEMS_TABLE } from '../../repository/south-item.repository';
import { NORTH_CONNECTORS_TABLE } from '../../repository/north-connector.repository';
import CreateTableBuilder = Knex.CreateTableBuilder;
import { EXTERNAL_SUBSCRIPTION_TABLE, SUBSCRIPTION_TABLE } from '../../repository/subscription.repository';

export async function up(knex: Knex): Promise<void> {
  await createEnginesTable(knex);
  await createUsersTable(knex);
  await createExternalSourcesTable(knex);
  await createIpFiltersTable(knex);
  await createScanModesTable(knex);
  await createHistoryQueriesTable(knex);
  await createHistoryItemsTable(knex);
  await createSouthConnectorsTable(knex);
  await createSouthItemsTable(knex);
  await createNorthConnectorsTable(knex);
  await createSubscriptionsTable(knex);
  await createExternalSubscriptionsTable(knex);
}

function createDefaultEntityFields(table: CreateTableBuilder): void {
  table.uuid('id').primary();
  table.timestamps(false, true);
}

async function createEnginesTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(ENGINES_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('name').notNullable().defaultTo('OIBus').unique();
    table.integer('port').notNullable().defaultTo(2223);
    table.enum('log_console_level', LOG_LEVELS).notNullable().defaultTo('silent');
    table.enum('log_file_level', LOG_LEVELS).notNullable().defaultTo('silent');
    table.integer('log_file_max_file_size').notNullable().defaultTo(50);
    table.integer('log_file_number_of_files').notNullable().defaultTo(5);
    table.enum('log_database_level', LOG_LEVELS).notNullable().defaultTo('silent');
    table.integer('log_database_max_number_of_logs').notNullable().defaultTo(100_000);
    table.enum('log_loki_level', LOG_LEVELS).notNullable().defaultTo('silent');
    table.integer('log_loki_interval').notNullable().defaultTo(60);
    table.string('log_loki_address');
    table.string('log_loki_token_address');
    table.string('log_loki_username');
    table.string('log_loki_password');
  });
}

async function createUsersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(USERS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('login').notNullable().unique();
    table.string('password').notNullable();
    table.string('first_name');
    table.string('last_name');
    table.string('email');
    table.string('language');
    table.string('timezone');
  });
}

async function createExternalSourcesTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(EXTERNAL_SOURCES_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('reference').notNullable().unique();
    table.string('description');
  });
}

async function createIpFiltersTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(IP_FILTERS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('address').notNullable().unique();
    table.string('description');
  });
}

async function createScanModesTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SCAN_MODES_TABLE, table => {
    table.uuid('id').primary();
    table.string('name').notNullable().unique();
    table.string('description');
    table.string('cron').notNullable();
  });
}

async function createHistoryQueriesTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_QUERIES_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('name').notNullable().unique();
    table.string('description');
    table.boolean('enabled').notNullable();
    table.datetime('start_time').notNullable();
    table.datetime('end_time').notNullable();
    table.string('south_type').notNullable();
    table.string('north_type').notNullable();
    table.json('south_settings').notNullable();
    table.json('north_settings').notNullable();
    table.integer('history_max_instant_per_item').notNullable();
    table.integer('history_max_read_interval').notNullable();
    table.integer('history_read_delay').notNullable();
    table.string('caching_scan_mode_id').notNullable();
    table.foreign('caching_scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    table.integer('caching_group_count').notNullable();
    table.integer('caching_retry_interval').notNullable();
    table.integer('caching_retry_count').notNullable();
    table.integer('caching_max_send_count').notNullable();
    table.integer('caching_send_file_immediately').notNullable();
    table.integer('caching_max_size').notNullable();
    table.integer('archive_enabled').notNullable();
    table.integer('archive_retention_duration').notNullable();
  });
}

async function createHistoryItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_ITEMS_TABLE, table => {
    createDefaultEntityFields(table);
    table.uuid('history_id').notNullable();
    table.foreign('history_id').references('id').inTable(HISTORY_QUERIES_TABLE);
    table.string('name').notNullable().unique();
    table.boolean('enabled').notNullable();
    table.string('description');
    table.json('settings').notNullable();
  });
}

async function createSouthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_CONNECTORS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('name').notNullable().unique();
    table.string('type').notNullable();
    table.string('description');
    table.boolean('enabled').notNullable();
    table.json('settings').notNullable();
    table.integer('history_max_instant_per_item').notNullable();
    table.integer('history_max_read_interval').notNullable();
    table.integer('history_read_delay').notNullable();
  });
}

async function createSouthItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_ITEMS_TABLE, table => {
    createDefaultEntityFields(table);
    table.uuid('connector_id').notNullable();
    table.foreign('connector_id').references('id').inTable(SOUTH_CONNECTORS_TABLE);
    table.uuid('scan_mode_id').notNullable();
    table.foreign('scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    table.string('name').notNullable();
    table.boolean('enabled').notNullable();
    table.json('settings').notNullable();
    table.unique(['connector_id', 'name']);
  });
}

async function createNorthConnectorsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_CONNECTORS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('name').notNullable().unique();
    table.string('type').notNullable();
    table.string('description');
    table.boolean('enabled').notNullable();
    table.json('settings').notNullable();
    table.string('caching_scan_mode_id').notNullable();
    table.foreign('caching_scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    table.integer('caching_group_count').notNullable();
    table.integer('caching_retry_interval').notNullable();
    table.integer('caching_retry_count').notNullable();
    table.integer('caching_max_send_count').notNullable();
    table.integer('caching_send_file_immediately').notNullable();
    table.integer('caching_max_size').notNullable();
    table.integer('archive_enabled').notNullable();
    table.integer('archive_retention_duration').notNullable();
  });
}

async function createSubscriptionsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SUBSCRIPTION_TABLE, table => {
    table.timestamps(false, true);
    table.string('north_connector_id').notNullable();
    table.foreign('north_connector_id').references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.string('south_connector_id').notNullable();
    table.foreign('south_connector_id').references('id').inTable(SOUTH_CONNECTORS_TABLE);
    table.primary(['north_connector_id', 'south_connector_id']);
  });
}

async function createExternalSubscriptionsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(EXTERNAL_SUBSCRIPTION_TABLE, table => {
    table.timestamps(false, true);
    table.string('north_connector_id').notNullable();
    table.foreign('north_connector_id').references('id').inTable(NORTH_CONNECTORS_TABLE);
    table.string('external_source_id').notNullable();
    table.foreign('external_source_id').references('id').inTable(EXTERNAL_SOURCES_TABLE);
    table.primary(['north_connector_id', 'external_source_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(NORTH_CONNECTORS_TABLE);
  await knex.schema.dropTable(SOUTH_ITEMS_TABLE);
  await knex.schema.dropTable(SOUTH_CONNECTORS_TABLE);
  await knex.schema.dropTable(HISTORY_ITEMS_TABLE);
  await knex.schema.dropTable(HISTORY_QUERIES_TABLE);
  await knex.schema.dropTable(SCAN_MODES_TABLE);
  await knex.schema.dropTable(EXTERNAL_SOURCES_TABLE);
  await knex.schema.dropTable(IP_FILTERS_TABLE);
  await knex.schema.dropTable(ENGINES_TABLE);
}
