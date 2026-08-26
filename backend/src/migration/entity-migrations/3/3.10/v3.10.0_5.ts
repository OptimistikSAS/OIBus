import { Knex } from 'knex';

const SOUTH_ITEMS_TABLE = 'south_items';
const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';

/**
 * Adds the two columns south_items needs to support Configuration Workflows:
 *
 *  - `created_by_workflow_id` — the *only* ownership record for a self-scoping (multi-item) workflow's
 *    items: `ON DELETE SET NULL` so an item outlives the workflow that created it, only the ownership
 *    link is cleared. Never set by the normal item create/update path (only by workflow-specific
 *    repository methods added alongside this).
 *  - `disabled_reason` — set only when a workflow auto-disables an item because its discovery no longer
 *    finds the entry it corresponds to. A person's own manual disable (`disableItem()`) leaves this
 *    null, so the two are never confused without needing a second boolean alongside the existing
 *    `enabled` column.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
    table.string('created_by_workflow_id', 36).nullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('SET NULL');
    table.text('disabled_reason').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, table => {
    table.dropColumn('created_by_workflow_id');
    table.dropColumn('disabled_reason');
  });
}
