import { Knex } from 'knex';

const ITEM_POINT_METADATA_TABLE = 'item_point_metadata';
const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const SOUTH_ITEMS_TABLE = 'south_items';

/**
 * Introduces `item_point_metadata` — one schema covering all three cardinalities a Configuration
 * Workflow's Act step can produce, distinguished only by how `south_item_id` repeats across rows:
 *
 *  - 1:1 (a single OPC-UA/Folder item) — one row, unique `south_item_id`.
 *  - N:1 (a SQL item's dedicated metadata query fanning out into several points) — several rows
 *    sharing the same `south_item_id`, one per result column.
 *  - 1:N (a self-scoping workflow's multi-item discovery) — several rows, each with its own
 *    `south_item_id`, all sharing the same `workflow_id`.
 *
 * `UNIQUE(workflow_id, discovered_entry_key)` is the one lookup every run's diff uses — no case needs
 * its own matching strategy. `discovered_metadata` is the previous run's snapshot of the record this
 * row came from, compared against the new retrieval to classify it new/changed/unchanged/missing; this
 * is populated regardless of whether the workflow pushes remote metadata at all (`remoteFieldMapping`
 * can be null), since it's also how a purely item-creating workflow recognizes "the same" entry across
 * runs. `description`/`unit`/`min_acceptable_value`/`max_acceptable_value`/`resolution`/
 * `resampling_method` mirror OIAnalytics's own `Data`/`StoredContinuousData` shape;
 * `remote_metadata_extra` is a JSON escape hatch for anything not yet modeled as its own column.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(ITEM_POINT_METADATA_TABLE, table => {
    table.string('id', 36).primary();
    table.string('workflow_id', 36).notNullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('CASCADE');
    table.string('south_item_id', 36).notNullable().references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.text('discovered_entry_key').notNullable();
    table.text('discovered_metadata').notNullable();
    table.text('description').nullable();
    table.string('unit').nullable();
    table.double('min_acceptable_value').nullable();
    table.double('max_acceptable_value').nullable();
    table.double('resolution').nullable();
    table.string('resampling_method').nullable();
    table.text('remote_metadata_extra').nullable();
    table.string('status').notNullable().defaultTo('active');
    table.datetime('orphaned_at').nullable();
    table.datetime('last_pushed_at').nullable();
    table.unique(['workflow_id', 'discovered_entry_key']);
    table.index(['south_item_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(ITEM_POINT_METADATA_TABLE);
}
