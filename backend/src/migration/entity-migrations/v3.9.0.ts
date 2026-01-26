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
  await knex.schema.raw(`CREATE TABLE ${SOUTH_ITEM_GROUPS_TABLE} (
    id char(36) PRIMARY KEY,
    created_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_at datetime DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    name varchar(255) NOT NULL,
    south_id char(36) NOT NULL,
    scan_mode_id char(36) NOT NULL,
    share_tracked_instant boolean NOT NULL DEFAULT 0,
    overlap integer,
    UNIQUE (name, south_id),
    FOREIGN KEY (south_id) REFERENCES ${SOUTH_CONNECTORS_TABLE}(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_mode_id) REFERENCES ${SCAN_MODES_TABLE}(id)
  );`);
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
