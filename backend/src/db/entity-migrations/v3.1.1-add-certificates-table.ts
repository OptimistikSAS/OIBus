import { Knex } from 'knex';
const CERTIFICATES_TABLE = 'certificates';

export async function up(knex: Knex): Promise<void> {
  await createCertificatesTable(knex);
}

async function createCertificatesTable(knex: Knex): Promise<void> {
  await knex.schema.raw(`create table ${CERTIFICATES_TABLE}
                                  (id          char(36) primary key,
                                   created_at  datetime default CURRENT_TIMESTAMP not null,
                                   updated_at  datetime default CURRENT_TIMESTAMP not null,
                                   name        varchar not null,
                                   description varchar,
                                   public_key varchar not null,
                                   private_key varchar not null,
                                   expiry varchar,
                                   certificate varchar not null);`);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
