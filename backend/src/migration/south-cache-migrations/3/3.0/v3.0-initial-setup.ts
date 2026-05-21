import { Knex } from 'knex';

const SOUTH_CACHE_TABLE = 'cache_history';

export async function up(knex: Knex): Promise<void> {
  await createSouthCacheHistoryTable(knex);
}

async function createSouthCacheHistoryTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_CACHE_TABLE, table => {
    table.uuid('south_id').notNullable();
    table.uuid('scan_mode_id').notNullable();
    table.uuid('item_id').notNullable();
    table.primary(['south_id', 'scan_mode_id', 'item_id']);
    table.datetime('max_instant');
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(SOUTH_CACHE_TABLE);
}
