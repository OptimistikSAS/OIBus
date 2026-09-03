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
 *
 * Uses raw single-statement `ALTER TABLE ... ADD COLUMN`/`DROP COLUMN` (an in-place metadata change on
 * SQLite) instead of knex's schema builder. Adding a column with a `.references()` FK via knex's builder
 * makes it rebuild the whole table (CREATE __new + COPY + DROP TABLE + RENAME), and that DROP can fail
 * with a foreign key constraint error: `configuration_workflows.target_item_id` (added in the previous
 * migration) already references `south_items`, and SQLite refuses to drop a table another table's live
 * FK still points into if that FK would be left dangling. The raw single-statement form sidesteps the
 * rebuild entirely: adding a nullable column (even with a REFERENCES clause) or dropping a column
 * (SQLite >= 3.35) is an in-place metadata edit, with no table rebuild and no DROP TABLE involved - same
 * reasoning as the raw `ALTER TABLE ... DROP COLUMN` already used in v3.9.0.ts for exactly this class of
 * problem.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE "${SOUTH_ITEMS_TABLE}" ADD COLUMN "created_by_workflow_id" varchar(36) REFERENCES "${CONFIGURATION_WORKFLOWS_TABLE}" ("id") ON DELETE SET NULL`
  );
  await knex.raw(`ALTER TABLE "${SOUTH_ITEMS_TABLE}" ADD COLUMN "disabled_reason" text`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE "${SOUTH_ITEMS_TABLE}" DROP COLUMN "created_by_workflow_id"`);
  await knex.raw(`ALTER TABLE "${SOUTH_ITEMS_TABLE}" DROP COLUMN "disabled_reason"`);
}
