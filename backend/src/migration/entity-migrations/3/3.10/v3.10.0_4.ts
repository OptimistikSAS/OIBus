import { Knex } from 'knex';

const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Introduces the `configuration_workflows` table — the first piece of the Configuration Workflow
 * feature (discover a data source, map what's found to south item settings and, optionally, remote
 * point metadata, on demand or on a schedule).
 *
 * `south_id` is always populated (a workflow is always created from a specific south connector's
 * context), even when `target_item_id` is null — the two are independent so a query can scope by
 * connector without joining through the target. `target_item_id` is nullable and means two different
 * things depending on whether it's set: populated, the workflow manages exactly one pre-existing
 * item's point metadata (e.g. a SQL query item, or a single node someone already created by hand);
 * null, the workflow is self-scoping and owns whatever items its own discovery creates (tracked via
 * `south_items.created_by_workflow_id`, added in a later migration — deliberately not a group, see the
 * design note this feature was built from).
 *
 * `discovery_scope`, `identity_key_fields`, `eligibility_filter`, `item_field_mapping` and
 * `remote_field_mapping` are stored as JSON text rather than normalized columns: they're
 * connector-specific and open-ended (an OPC-UA root node id, a folder subtree, a dedicated SQL
 * metadata query, ...), the same way `south_items.settings` already stores connector-specific item
 * configuration as JSON.
 *
 * `item_field_mapping` and `remote_field_mapping` are both nullable, and at least one of the two must
 * be set — enforced at the service layer, not here (no CHECK constraints are used anywhere in this
 * schema for that kind of invariant). A workflow can therefore be item-only, remote-metadata-only (a
 * dedicated SQL metadata query enriching an already-existing item without ever touching it), or both.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(CONFIGURATION_WORKFLOWS_TABLE, table => {
    table.string('id', 36).primary();
    table.datetime('created_at').notNullable();
    table.datetime('updated_at').notNullable();
    table.string('created_by');
    table.string('updated_by');
    table.string('name').notNullable();
    table.string('south_id', 36).notNullable().references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('CASCADE');
    table.string('target_item_id', 36).nullable().references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.text('discovery_scope').notNullable();
    table.text('identity_key_fields').notNullable();
    table.text('eligibility_filter').notNullable();
    table.text('item_field_mapping').nullable();
    table.text('remote_field_mapping').nullable();
    table.string('scan_mode_id', 36).nullable().references('id').inTable(SCAN_MODES_TABLE).onDelete('SET NULL');
    table.boolean('enabled').notNullable().defaultTo(true);
    table.unique(['south_id', 'name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(CONFIGURATION_WORKFLOWS_TABLE);
}
