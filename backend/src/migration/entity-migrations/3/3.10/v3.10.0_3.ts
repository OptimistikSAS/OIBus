import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';

/**
 * Add the HTTPS settings of the web server to engines: whether it serves HTTPS, and where it reads the certificate and
 * private key from (a certificate of the store, or PEM files). Existing installs keep serving HTTP.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.boolean('https_enabled').notNullable().defaultTo(false);
    t.string('https_certificate_source').notNullable().defaultTo('store');
    t.string('https_certificate_id');
    t.string('https_certificate_path');
    t.string('https_private_key_path');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.dropColumn('https_enabled');
    t.dropColumn('https_certificate_source');
    t.dropColumn('https_certificate_id');
    t.dropColumn('https_certificate_path');
    t.dropColumn('https_private_key_path');
  });
}
