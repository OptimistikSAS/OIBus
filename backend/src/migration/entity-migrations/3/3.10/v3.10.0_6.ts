import { Knex } from 'knex';

const WORKFLOW_RUNS_TABLE = 'workflow_runs';
const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';

/**
 * Introduces `workflow_runs` — the run history for Configuration Workflows. One row per execution
 * (manual or scheduled), reviewable independent of whether anyone was watching. Unlike
 * `configuration_workflows`, this table has no `AuditService` wiring: it *is* the audit trail for a
 * run, the same way `audit_logs` itself isn't audited.
 *
 * Counts mirror the four-step run lifecycle a run goes through: Retrieve produces
 * `discovered_count` records; the workflow's `eligibility_filter` narrows that to
 * `eligible_count`; of those, Act only ever touches new/changed/missing ones, split into
 * `created_count`/`updated_count`/`disabled_count` (item actions) and `pushed_count` (remote
 * metadata pushes) — independent numbers, since a workflow can be item-only, remote-only, or both.
 * All default to 0 so a run that errors before reaching a step still has well-defined counts rather
 * than nulls.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(WORKFLOW_RUNS_TABLE, table => {
    table.string('id', 36).primary();
    table.string('workflow_id', 36).notNullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('CASCADE');
    table.string('trigger_type').notNullable();
    table.string('status').notNullable();
    table.datetime('started_at').notNullable();
    table.datetime('completed_at').nullable();
    table.integer('discovered_count').notNullable().defaultTo(0);
    table.integer('eligible_count').notNullable().defaultTo(0);
    table.integer('created_count').notNullable().defaultTo(0);
    table.integer('updated_count').notNullable().defaultTo(0);
    table.integer('disabled_count').notNullable().defaultTo(0);
    table.integer('pushed_count').notNullable().defaultTo(0);
    table.text('error').nullable();
    table.string('triggered_by').nullable();
    table.index(['workflow_id', 'started_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(WORKFLOW_RUNS_TABLE);
}
