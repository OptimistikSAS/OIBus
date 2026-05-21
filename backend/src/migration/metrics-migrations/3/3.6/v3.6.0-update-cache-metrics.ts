import { Knex } from 'knex';

const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';
const NORTH_METRICS_TABLE = 'north_metrics';

export async function up(knex: Knex): Promise<void> {
  await updateHistoryQueryMetricsTable(knex);
  await updateNorthMetricsTable(knex);
}

async function updateNorthMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(NORTH_METRICS_TABLE, table => {
    table.dropColumns('nb_values_sent', 'nb_files_sent', 'last_value_sent', 'last_file_sent', 'cache_size', 'error_size', 'archive_size');
  });
  await knex.schema.alterTable(NORTH_METRICS_TABLE, table => {
    table.integer('content_sent_size');
    table.integer('content_cached_size');
    table.integer('content_errored_size');
    table.integer('content_archived_size');
    table.integer('current_cache_size');
    table.integer('current_error_size');
    table.integer('current_archive_size');
    table.string('last_content_sent');
  });
  await knex(NORTH_METRICS_TABLE).update({
    content_sent_size: 0,
    content_cached_size: 0,
    content_errored_size: 0,
    content_archived_size: 0,
    current_cache_size: 0,
    current_error_size: 0,
    current_archive_size: 0,
    last_content_sent: null
  });
}

async function updateHistoryQueryMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.alterTable(HISTORY_QUERY_METRICS_TABLE, table => {
    table.dropColumns('nb_values_sent', 'nb_files_sent', 'last_value_sent', 'last_file_sent');
  });
  await knex.schema.alterTable(HISTORY_QUERY_METRICS_TABLE, table => {
    table.integer('content_sent_size');
    table.integer('content_cached_size');
    table.integer('content_errored_size');
    table.integer('content_archived_size');
    table.integer('north_current_cache_size');
    table.integer('north_current_error_size');
    table.integer('north_current_archive_size');
    table.string('last_content_sent');
  });
  await knex(HISTORY_QUERY_METRICS_TABLE).update({
    content_sent_size: 0,
    content_cached_size: 0,
    content_errored_size: 0,
    content_archived_size: 0,
    north_current_cache_size: 0,
    north_current_error_size: 0,
    north_current_archive_size: 0,
    last_content_sent: null
  });
}

export async function down(): Promise<void> {
  return;
}
