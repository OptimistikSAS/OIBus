import { Knex } from 'knex';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const TABLES = [NORTH_CONNECTORS_TABLE, HISTORY_QUERIES_TABLE];

/**
 * The cache, error and archive folders each get their own maximum size. Before, the single
 * `caching_throttling_cache_max_size` limited the three folders together: the error and archive folders start with
 * that same limit.
 */
export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.schema.alterTable(table, builder => {
      builder.integer('caching_error_max_size').notNullable().defaultTo(0);
      builder.integer('caching_archive_max_size').notNullable().defaultTo(0);
    });
    await knex(table).update({
      caching_error_max_size: knex.ref('caching_throttling_cache_max_size'),
      caching_archive_max_size: knex.ref('caching_throttling_cache_max_size')
    });
  }
}

/**
 * Uses native SQLite `DROP COLUMN` instead of knex's `dropColumn()`, which rebuilds the table and fails on the foreign
 * keys pointing to it (see v3.10.0).
 */
export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.raw(`ALTER TABLE ${table} DROP COLUMN caching_error_max_size`);
    await knex.raw(`ALTER TABLE ${table} DROP COLUMN caching_archive_max_size`);
  }
}
