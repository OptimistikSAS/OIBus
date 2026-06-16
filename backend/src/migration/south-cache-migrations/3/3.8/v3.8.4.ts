import { Knex } from 'knex';

/**
 * Consolidate the per-connector `south_item_cache_{connectorId}` tables into a
 * single `south_item_cache` table with a `south_id` column.
 *
 * The per-connector table design was introduced in v3.8.0 to replace the old
 * global `cache_history` table, but it created operational overhead: every new
 * connector requires a DDL statement, and the repository had to maintain a
 * prepared-statement cache keyed by connector ID. A single parameterised table
 * is simpler and consistent with how the rest of the cache databases are structured.
 *
 * Migration steps:
 *   1. Create `south_item_cache` with PRIMARY KEY (south_id, item_id).
 *   2. Enumerate every `south_item_cache_*` table, extract the connector ID from
 *      the table name suffix, and INSERT its rows into the new table.
 *   3. Drop the old per-connector table.
 *
 * Idempotent: if `south_item_cache` already exists (migration was already applied)
 * the CREATE is a no-op, and the LIKE query finds no old tables, so the loop body
 * never executes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE TABLE IF NOT EXISTS south_item_cache (` +
      'south_id TEXT NOT NULL, ' +
      'item_id TEXT NOT NULL, ' +
      'group_id TEXT, ' +
      'query_time TEXT, ' +
      'value TEXT, ' +
      'tracked_instant TEXT, ' +
      'PRIMARY KEY (south_id, item_id)' +
      ')'
  );

  const tables: Array<{ name: string }> = await knex.raw(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'south_item_cache_%'`
  );

  const PREFIX = 'south_item_cache_';
  for (const { name } of tables) {
    const southId = name.slice(PREFIX.length);
    await knex.raw(
      `INSERT OR IGNORE INTO south_item_cache (south_id, item_id, group_id, query_time, value, tracked_instant) ` +
        `SELECT ?, item_id, group_id, query_time, value, tracked_instant FROM "${name}"`,
      [southId]
    );
    await knex.raw(`DROP TABLE "${name}"`);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
