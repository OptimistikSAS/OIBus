import { Knex } from 'knex';

const GROUP_ITEMS_TABLE = 'group_items';

/**
 * Add an index on group_items.item_id.
 *
 * The table has a composite primary key (group_id, item_id), which SQLite implements as a B-tree
 * ordered by (group_id, item_id). Queries that filter only on item_id — i.e. finding the group for
 * a given item — could not use that index and fell back to a full table scan. With 12 000 items
 * this caused O(n) scans per item lookup, contributing to the N+1 performance problem in
 * findAllItemsForSouth. This index makes those lookups O(log n).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.table(GROUP_ITEMS_TABLE, table => {
    table.index(['item_id'], 'group_items_item_id_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table(GROUP_ITEMS_TABLE, table => {
    table.dropIndex(['item_id'], 'group_items_item_id_idx');
  });
}
