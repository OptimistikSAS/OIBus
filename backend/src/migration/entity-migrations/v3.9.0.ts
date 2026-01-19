import { Knex } from 'knex';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SCAN_MODES_TABLE = 'scan_modes';

export async function up(knex: Knex): Promise<void> {
  await createSouthItemGroupsTable(knex);
  await addGroupIdToSouthItems(knex);
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

async function addGroupIdToSouthItems(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
    table.uuid('group_id').nullable();
    table.foreign('group_id').references('id').inTable(SOUTH_ITEM_GROUPS_TABLE).onDelete('SET NULL');
  });
}

export async function down(_knex: Knex): Promise<void> {
  // Migration rollback not implemented
  return;
}
