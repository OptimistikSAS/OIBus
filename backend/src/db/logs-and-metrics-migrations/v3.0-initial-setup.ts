import { Knex } from 'knex';
import { LOG_TABLE } from '../../repository/log.repository';
import { LOG_LEVELS, SCOPE_TYPES } from '../../../../shared/model/engine.model';
import { NORTH_METRICS_TABLE } from '../../repository/north-connector-metrics.repository';
import { SOUTH_METRICS_TABLE } from '../../repository/south-connector-metrics.repository';

export async function up(knex: Knex): Promise<void> {
  await createLogsTable(knex);
  await createSouthMetricsTable(knex);
  await createNorthMetricsTable(knex);
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
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(LOG_TABLE);
  await knex.schema.dropTable(SOUTH_METRICS_TABLE);
  await knex.schema.dropTable(NORTH_METRICS_TABLE);
}
