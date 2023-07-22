import { Knex } from 'knex';
import { SOUTH_CACHE_TABLE } from '../../repository/south-cache.repository';
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { SCAN_MODES_TABLE } from '../../repository/scan-mode.repository';
import { SOUTH_ITEMS_TABLE } from '../../repository/south-item.repository';

export async function up(knex: Knex): Promise<void> {
  await createSouthCacheHistoryTable(knex);
}

async function createSouthCacheHistoryTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_CACHE_TABLE, table => {
    table.uuid('south_id').notNullable();
    table.foreign('south_id').references('id').inTable(SOUTH_CONNECTORS_TABLE);
    table.uuid('scan_mode_id').notNullable();
    table.foreign('scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    table.uuid('item_id').notNullable();
    table.foreign('item_id').references('id').inTable(SOUTH_ITEMS_TABLE);
    table.primary(['south_id', 'scan_mode_id', 'item_id']);
    table.datetime('max_instant');
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(SOUTH_CACHE_TABLE);
}
