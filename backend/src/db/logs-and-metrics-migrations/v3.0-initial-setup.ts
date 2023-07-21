import { Knex } from 'knex';
import { LOG_TABLE } from '../../repository/log.repository';
import { LOG_LEVELS, SCOPE_TYPES } from '../../../../shared/model/engine.model';

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

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(LOG_TABLE);
}
