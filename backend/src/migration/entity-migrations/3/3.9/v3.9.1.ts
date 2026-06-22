import { Knex } from 'knex';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.string('recovery_strategy').nullable();
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.string('recovery_strategy').nullable();
  });
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
