import { Knex } from 'knex';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SCAN_MODES_TABLE = 'scan_modes';

const GROUP_ITEMS_TABLE = 'group_items';

export async function up(knex: Knex): Promise<void> {
  await createSouthItemGroupsTable(knex);
  await createGroupItemsTable(knex);
}

async function createSouthItemGroupsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(SOUTH_ITEM_GROUPS_TABLE, table => {
    table.uuid('id').primary();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    table.string('name', 255).notNullable();
    table.uuid('south_id').notNullable();
    table.foreign('south_id').references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('CASCADE');
    table.uuid('scan_mode_id').notNullable();
    table.foreign('scan_mode_id').references('id').inTable(SCAN_MODES_TABLE);
    table.boolean('share_tracked_instant').notNullable().defaultTo(false);
    table.integer('overlap').nullable();
    table.unique(['name', 'south_id']);
  });
}

async function createGroupItemsTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(GROUP_ITEMS_TABLE, table => {
    table.uuid('group_id').notNullable();
    table.foreign('group_id').references('id').inTable(SOUTH_ITEM_GROUPS_TABLE).onDelete('CASCADE');
    table.uuid('item_id').notNullable();
    table.foreign('item_id').references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.primary(['group_id', 'item_id']);
  });
}

export async function down(_knex: Knex): Promise<void> {
  // Migration rollback not implemented
  return;
}
