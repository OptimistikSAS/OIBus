import { Knex } from 'knex';

const AUDIT_LOGS_TABLE = 'audit_logs';
const ENGINES_TABLE = 'engines';

/**
 * Introduces the audit trail feature:
 *
 *  1. A new `audit_logs` table recording every create/update/delete performed on an audited entity
 *     (south/north connectors, items, scan modes, users, ...). `previous_state`/`new_state` hold a
 *     JSON snapshot of the entity before/after the change — null for `CREATE` (no previous state) and
 *     `DELETE` (no new state) respectively. Indexed by `(entity_type, entity_id)` for per-entity
 *     history lookups, and by `created_at` for retention pruning and time-ranged searches.
 *  2. `engines.audit_retention_duration`, the number of days audit log rows are kept before being
 *     pruned (null/0 meaning "keep forever"), backfilled to 90 on the existing row.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(AUDIT_LOGS_TABLE, table => {
    table.string('id').primary();
    table.string('entity_type').notNullable();
    table.string('entity_id').notNullable();
    table.string('action').notNullable();
    table.text('previous_state').nullable();
    table.text('new_state').nullable();
    table.string('user_id').notNullable();
    table.string('created_at').notNullable();
    table.index(['entity_type', 'entity_id']);
    table.index(['created_at']);
  });

  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.integer('audit_retention_duration').nullable();
  });

  await knex(ENGINES_TABLE).update({ audit_retention_duration: 90 });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(AUDIT_LOGS_TABLE);

  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.dropColumn('audit_retention_duration');
  });
}
