import { Knex } from 'knex';
import { LOG_TABLE } from '../../repository/log.repository';
import { LOG_LEVELS } from '../../../../shared/model/engine.model';
import { NORTH_METRICS_TABLE } from '../../repository/north-connector-metrics.repository';
import { SOUTH_METRICS_TABLE } from '../../repository/south-connector-metrics.repository';
import { ENGINE_METRICS_TABLE } from '../../repository/engine-metrics.repository';

const SCOPE_TYPES = ['south', 'north', 'engine', 'data-stream', 'history-engine', 'history-query', 'web-server', 'logger-service'];

export async function up(knex: Knex): Promise<void> {
  await createLogsTable(knex);
  await createSouthMetricsTable(knex);
  await createNorthMetricsTable(knex);
  await createEngineMetricsTable(knex);
}

async function createLogsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(LOG_TABLE, table => {
    table.datetime('timestamp').notNullable();
    table.enum('level', LOG_LEVELS).notNullable();
    table.enum('scope_type', SCOPE_TYPES).notNullable();
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });
}

async function createSouthMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_METRICS_TABLE, table => {
    table.uuid('south_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values');
    table.integer('nb_files');
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.json('last_value');
    table.string('last_file');
  });
}

async function createNorthMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(NORTH_METRICS_TABLE, table => {
    table.uuid('north_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('nb_values');
    table.integer('nb_files');
    table.datetime('last_connection');
    table.datetime('last_run_start');
    table.integer('last_run_duration');
    table.json('last_value');
    table.string('last_file');
    table.integer('cache_size');
  });
}

async function createEngineMetricsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(ENGINE_METRICS_TABLE, table => {
    table.uuid('engine_id').notNullable();
    table.datetime('metrics_start').notNullable();
    table.integer('process_cpu_usage_instant');
    table.integer('process_cpu_usage_average');
    table.integer('process_uptime');
    table.integer('free_memory');
    table.integer('total_memory');
    table.integer('min_rss');
    table.integer('current_rss');
    table.integer('max_rss');
    table.integer('min_heap_total');
    table.integer('current_heap_total');
    table.integer('max_heap_total');
    table.integer('min_heap_used');
    table.integer('current_heap_used');
    table.integer('max_heap_used');
    table.integer('min_external');
    table.integer('current_external');
    table.integer('max_external');
    table.integer('min_array_buffers');
    table.integer('current_array_buffers');
    table.integer('max_array_buffers');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(LOG_TABLE);
  await knex.schema.dropTable(SOUTH_METRICS_TABLE);
  await knex.schema.dropTable(NORTH_METRICS_TABLE);
}
