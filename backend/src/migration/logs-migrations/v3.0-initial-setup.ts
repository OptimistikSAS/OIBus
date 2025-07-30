import { Knex } from 'knex';
import { LOG_LEVELS } from '../../../shared/model/engine.model';

const LOG_TABLE = 'logs';

const SCOPE_TYPES = ['south', 'north', 'engine', 'data-stream', 'history-engine', 'history-query', 'web-server', 'logger-service'];

export async function up(knex: Knex): Promise<void> {
  await createLogsTable(knex);
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

export async function down(): Promise<void> {
  return;
}
