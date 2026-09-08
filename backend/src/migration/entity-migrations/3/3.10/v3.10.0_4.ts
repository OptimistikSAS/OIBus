import { Knex } from 'knex';

const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Introduces the `configuration_workflows` table — the first piece of the Configuration Workflow
 * feature (discover a data source, then either create/update south items locally from what's found, or
 * push the raw discovered records to OIAnalytics, on demand or on a schedule).
 *
 * `south_id` is always populated (a workflow is always created from a specific south connector's
 * context). A workflow is self-scoping — it owns whatever items its own discovery creates, tracked via
 * `south_items.created_by_workflow_id` (added in a later migration — deliberately not a group, see the
 * design note this feature was built from) — there's no "targets one pre-existing item" case: local
 * mode only ever creates/updates its own items, and remote mode has no local item at all.
 *
 * `discovery_scope`, `identity_key_fields`, `eligibility_filter` and `item_field_mapping` are stored as
 * JSON text rather than normalized columns: they're connector-specific and open-ended (an OPC-UA root
 * node id, a folder subtree, a dedicated SQL metadata query, ...), the same way `south_items.settings`
 * already stores connector-specific item configuration as JSON.
 *
 * A workflow is exactly one of two modes, enforced at the service layer (no CHECK constraints are used
 * anywhere in this schema for that kind of invariant): `item_field_mapping` set and
 * `push_to_oi_analytics` false (local — create/update items from what's discovered), or
 * `item_field_mapping` null and `push_to_oi_analytics` true (remote — forward the raw eligible records
 * to OIAnalytics on each run, requiring OIBus to be registered).
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
    table.text('discovery_scope').notNullable();
    table.text('identity_key_fields').notNullable();
    table.text('eligibility_filter').notNullable();
    table.text('item_field_mapping').nullable();
    table.boolean('push_to_oi_analytics').notNullable().defaultTo(false);
    table.string('scan_mode_id', 36).nullable().references('id').inTable(SCAN_MODES_TABLE).onDelete('SET NULL');
    table.boolean('enabled').notNullable().defaultTo(true);
    table.unique(['south_id', 'name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(CONFIGURATION_WORKFLOWS_TABLE);
}
