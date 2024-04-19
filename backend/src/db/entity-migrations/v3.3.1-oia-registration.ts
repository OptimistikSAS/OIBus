import { Knex } from 'knex';
import { REGISTRATIONS_TABLE } from '../../repository/registration.repository';

export async function up(knex: Knex): Promise<void> {
  await updateRegistrationSettings(knex);
}

async function updateRegistrationSettings(knex: Knex) {
  await knex.schema.raw(`create table ${REGISTRATIONS_TABLE}_dg_tmp
                         (
                           id                         char(36) primary key,
                           created_at                 datetime default CURRENT_TIMESTAMP not null,
                           updated_at                 datetime default CURRENT_TIMESTAMP not null,
                           host                       varchar(255)                       not null,
                           use_proxy                  boolean  default '0',
                           proxy_url                  varchar(255),
                           proxy_username             varchar(255),
                           proxy_password             varchar(255),
                           accept_unauthorized        boolean default '0',
                           activation_code            varchar(255),
                           check_url                  varchar(255),
                           activation_date            varchar(255),
                           activation_expiration_date varchar(255),
                           token                      varchar(255),
                           status                     text check (status in ('NOT_REGISTERED', 'PENDING', 'REGISTERED')) not null default 'NOT_REGISTERED'
);`);

  await knex.schema
    .raw(`insert into ${REGISTRATIONS_TABLE}_dg_tmp(id, created_at, updated_at, host, use_proxy, proxy_url, proxy_username, proxy_password,
                                                          accept_unauthorized, activation_code, check_url, activation_date,
                                                          activation_expiration_date, token, status)
                         select id,
                                created_at,
                                updated_at,
                                host,
                                use_proxy,
                                proxy_url,
                                proxy_username,
                                proxy_password,
                                accept_unauthorized,
                                activation_code,
                                check_url,
                                activation_date,
                                activation_expiration_date,
                                token,
                                status
                         from ${REGISTRATIONS_TABLE};`);

  await knex.schema.raw(`drop table ${REGISTRATIONS_TABLE};`);

  await knex.schema.raw(`alter table ${REGISTRATIONS_TABLE}_dg_tmp rename to ${REGISTRATIONS_TABLE};`);

  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.unique(['activation_code', 'check_url', 'host']);
  });
}

export async function down(_knex: Knex): Promise<void> {}
