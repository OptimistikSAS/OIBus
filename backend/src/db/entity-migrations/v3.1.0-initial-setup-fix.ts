import { Knex } from 'knex';
import { HISTORY_QUERY_STATUS } from '../../../shared/model/history-query.model';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

export async function up(knex: Knex): Promise<void> {
  await updateHistoryQueriesTable(knex);
}

async function updateHistoryQueriesTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`create table ${HISTORY_ITEMS_TABLE}_dg_tmp
                                  (id          char(36) primary key,
                                   created_at  datetime default CURRENT_TIMESTAMP not null,
                                   updated_at  datetime default CURRENT_TIMESTAMP not null,
                                   history_id  char(36) not null,
                                   name        varchar(255) not null,
                                   enabled     boolean not null,
                                   description varchar(255),
                                   settings    json not null);`);

  await knex.schema
    .raw(`insert into ${HISTORY_ITEMS_TABLE}_dg_tmp(id, created_at, updated_at, history_id, name, enabled, description, settings)
                    select id,
                           created_at,
                           updated_at,
                           history_id,
                           name,
                           enabled,
                           description,
                           settings
                    from ${HISTORY_ITEMS_TABLE};
    `);

  await knex.schema.raw(`drop table ${HISTORY_ITEMS_TABLE};`);
  await knex.schema.raw(`alter table ${HISTORY_ITEMS_TABLE}_dg_tmp rename to ${HISTORY_ITEMS_TABLE};`);

  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, async table => {
    table.enum('status', HISTORY_QUERY_STATUS).notNullable().defaultTo('PENDING');
    await knex(HISTORY_QUERIES_TABLE).where({ enabled: true }).update({ status: 'RUNNING' });
  });

  await knex.schema.raw(`create table ${HISTORY_QUERIES_TABLE}_dg_tmp
                (id                            char(36) primary key,
                 created_at                    datetime default CURRENT_TIMESTAMP not null,
                 updated_at                    datetime default CURRENT_TIMESTAMP not null,
                 status                        text check (status in ('PENDING', 'RUNNING', 'PAUSED', 'FINISHED', 'ABORTED')) not null default 'PENDING',
                 name                          varchar(255) not null,
                 description                   varchar(255),
                 start_time                    datetime not null,
                 end_time                      datetime not null,
                 south_type                    varchar(255) not null,
                 north_type                    varchar(255) not null,
                 south_settings                json not null,
                 north_settings                json not null,
                 history_max_instant_per_item  integer not null,
                 history_max_read_interval     integer not null,
                 history_read_delay            integer not null,
                 caching_scan_mode_id          varchar(255) not null references scan_modes,
                 caching_group_count           integer not null,
                 caching_retry_interval        integer not null,
                 caching_retry_count           integer not null,
                 caching_max_send_count        integer not null,
                 caching_send_file_immediately integer not null,
                 caching_max_size              integer not null,
                 archive_enabled               integer not null,
                 archive_retention_duration    integer not null
                );`);
  await knex.schema
    .raw(`insert into ${HISTORY_QUERIES_TABLE}_dg_tmp(id, created_at, updated_at, status, name, description, start_time, end_time, south_type,
                                         north_type, south_settings, north_settings, history_max_instant_per_item,
                                         history_max_read_interval, history_read_delay, caching_scan_mode_id,
                                         caching_group_count, caching_retry_interval, caching_retry_count,
                                         caching_max_send_count, caching_send_file_immediately, caching_max_size,
                                         archive_enabled, archive_retention_duration)
                    select id,
                           created_at,
                           updated_at,
                           status,
                           name,
                           description,
                           start_time,
                           end_time,
                           south_type,
                           north_type,
                           south_settings,
                           north_settings,
                           history_max_instant_per_item,
                           history_max_read_interval,
                           history_read_delay,
                           caching_scan_mode_id,
                           caching_group_count,
                           caching_retry_interval,
                           caching_retry_count,
                           caching_max_send_count,
                           caching_send_file_immediately,
                           caching_max_size,
                           archive_enabled,
                           archive_retention_duration
                    from ${HISTORY_QUERIES_TABLE};`);
  await knex.schema.raw(`drop table ${HISTORY_QUERIES_TABLE};`);
  await knex.schema.raw(`alter table ${HISTORY_QUERIES_TABLE}_dg_tmp rename to ${HISTORY_QUERIES_TABLE};`);

  await knex.schema.alterTable(HISTORY_QUERIES_TABLE, table => {
    table.unique('name');
  });

  await knex.schema.raw(`create table ${HISTORY_ITEMS_TABLE}_dg_tmp
                                  (id          char(36) primary key,
                                   created_at  datetime default CURRENT_TIMESTAMP not null,
                                   updated_at  datetime default CURRENT_TIMESTAMP not null,
                                   history_id  char(36) not null constraint history_id references ${HISTORY_QUERIES_TABLE},
                                   name        varchar(255) not null,
                                   enabled     boolean not null,
                                   description varchar(255),
                                   settings    json not null);`);

  await knex.schema
    .raw(`insert into ${HISTORY_ITEMS_TABLE}_dg_tmp(id, created_at, updated_at, history_id, name, enabled, description, settings)
                    select id,
                           created_at,
                           updated_at,
                           history_id,
                           name,
                           enabled,
                           description,
                           settings
                    from ${HISTORY_ITEMS_TABLE};
    `);

  await knex.schema.raw(`drop table ${HISTORY_ITEMS_TABLE};`);
  await knex.schema.raw(`alter table ${HISTORY_ITEMS_TABLE}_dg_tmp rename to ${HISTORY_ITEMS_TABLE};`);

  await knex.schema.alterTable(HISTORY_ITEMS_TABLE, table => {
    table.unique(['history_id', 'name']);
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
