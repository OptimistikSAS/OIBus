import { Knex } from 'knex';
import { LOG_LEVELS } from '../../../../shared/model/engine.model';
const LOG_TABLE = 'logs';

const NEW_SCOPE_TYPES = ['south', 'north', 'history-query', 'internal', 'web-server'];

export async function up(knex: Knex): Promise<void> {
  await createLogsTable(knex);
}

async function createLogsTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`create table ${LOG_TABLE}_dg_tmp
                                  (timestamp  datetime default CURRENT_TIMESTAMP not null,
                                   level varchar(255),
                                   scope_type varchar(255),
                                   scope_id varchar(255),
                                   scope_name varchar(255),
                                   message    varchar);`);

  await knex.schema.raw(`insert into ${LOG_TABLE}_dg_tmp(timestamp, level, scope_type, scope_id, scope_name, message)
                    select timestamp,
                           level,
                           scope_type,
                           scope_id,
                           scope_name,
                           message
                    from ${LOG_TABLE};
    `);

  await knex(`${LOG_TABLE}_dg_tmp`).update({ scope_type: 'internal' }).where('scope_type', 'engine');
  await knex(`${LOG_TABLE}_dg_tmp`).update({ scope_type: 'internal' }).where('scope_type', 'data-stream');
  await knex(`${LOG_TABLE}_dg_tmp`).update({ scope_type: 'internal' }).where('scope_type', 'history-engine');
  await knex(`${LOG_TABLE}_dg_tmp`).update({ scope_type: 'internal' }).where('scope_type', 'logger-service');

  await knex.schema.raw(`drop table ${LOG_TABLE};`);
  await knex.schema.createTable(LOG_TABLE, table => {
    table.datetime('timestamp').notNullable();
    table.enum('level', LOG_LEVELS).notNullable();
    table.enum('scope_type', NEW_SCOPE_TYPES).notNullable().defaultTo('internal');
    table.text('scope_id');
    table.text('scope_name');
    table.text('message').notNullable();
  });

  await knex.schema.raw(`insert into ${LOG_TABLE}(timestamp, level, scope_type, scope_id, scope_name, message)
                    select timestamp,
                           level,
                           scope_type,
                           scope_id,
                           scope_name,
                           message
                    from ${LOG_TABLE}_dg_tmp;
    `);
  await knex.schema.raw(`drop table ${LOG_TABLE}_dg_tmp;`);
}

export async function down(): Promise<void> {
  return;
}
