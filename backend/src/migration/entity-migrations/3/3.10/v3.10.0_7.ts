import { Knex } from 'knex';

const ITEM_POINT_METADATA_TABLE = 'item_point_metadata';
const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const SOUTH_ITEMS_TABLE = 'south_items';

/**
 * Introduces `item_point_metadata` — how a local (item-creating) Configuration Workflow recognizes
 * "the same" discovered entry across runs, one row per south item it created/updated.
 *
 * `UNIQUE(workflow_id, discovered_entry_key)` is the one lookup every run's diff uses.
 * `discovered_metadata` is the previous run's snapshot of the record this row came from, compared
 * against the new retrieval to classify it new/changed/unchanged/missing, and to decide when to
 * auto-disable the item (see `status`/`orphaned_at` below). A remote (push-to-OIAnalytics) workflow
 * never writes here at all — it has no local item to track, and forwards each run's raw discovered
 * records without diffing against anything.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(ITEM_POINT_METADATA_TABLE, table => {
    table.string('id', 36).primary();
    table.string('workflow_id', 36).notNullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('CASCADE');
    table.string('south_item_id', 36).notNullable().references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.text('discovered_entry_key').notNullable();
    table.text('discovered_metadata').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.datetime('orphaned_at').nullable();
    table.unique(['workflow_id', 'discovered_entry_key']);
    table.index(['south_item_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(ITEM_POINT_METADATA_TABLE);
}
