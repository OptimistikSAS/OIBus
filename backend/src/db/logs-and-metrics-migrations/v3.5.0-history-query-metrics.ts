import { Knex } from 'knex';

const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';
const NORTH_METRICS_TABLE = 'north_metrics';
const SOUTH_METRICS_TABLE = 'south_metrics';

export async function up(knex: Knex): Promise<void> {
  await createHistoryQueryMetricsTable(knex);
  await removeConnectorMetrics(knex);
}

async function createHistoryQueryMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORY_QUERY_METRICS_TABLE, table => {
    table.uuid('history_query_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values_retrieved');
    table.integer('nb_files_retrieved');
    table.json('last_value_retrieved');
    table.string('last_file_retrieved');
    table.datetime('last_south_connection');
    table.datetime('last_south_run_start');
    table.integer('last_south_run_duration');
    table.integer('nb_values_sent');
    table.integer('nb_files_sent');
    table.json('last_value_sent');
    table.string('last_file_sent');
    table.datetime('last_north_connection');
    table.datetime('last_north_run_start');
    table.integer('last_north_run_duration');
    table.integer('north_cache_size');
  });
}

async function removeConnectorMetrics(knex: Knex): Promise<void> {
  await knex.table(NORTH_METRICS_TABLE).delete();
  await knex.table(SOUTH_METRICS_TABLE).delete();
}

export async function down(): Promise<void> {
  return;
}
