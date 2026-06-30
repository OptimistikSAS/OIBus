import { Knex } from 'knex';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.integer('start_time_offset').nullable().defaultTo(null);
    t.integer('end_time_offset').nullable().defaultTo(null);
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.integer('start_time_offset').nullable().defaultTo(null);
    t.integer('end_time_offset').nullable().defaultTo(null);
  });

  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET start_time_offset = -overlap WHERE overlap IS NOT NULL`);

  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('overlap');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('overlap');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.integer('overlap').nullable().defaultTo(null);
  });
  await knex.raw(`UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.raw(`UPDATE ${SOUTH_ITEMS_TABLE} SET overlap = -start_time_offset WHERE start_time_offset IS NOT NULL`);
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.dropColumn('start_time_offset');
    t.dropColumn('end_time_offset');
  });
}
