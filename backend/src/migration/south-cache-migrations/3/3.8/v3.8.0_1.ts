import { Knex } from 'knex';

/**
 * Repair migration for `south_item_cache_*` tables created by an earlier build of the
 * v3.8.0 south-cache migration.
 *
 * That earlier migration created the table with a composite `UNIQUE(item_id, group_id)`
 * instead of `item_id` as PRIMARY KEY. Because SQLite treats NULLs as distinct in a UNIQUE
 * constraint, non-grouped connectors (group_id = NULL — i.e. every SQL/ODBC/OLEDB/REST/…
 * connector) never hit the constraint on `INSERT OR REPLACE`. So each scan APPENDED a new row
 * rather than replacing, and `getItemLastValue` (`WHERE item_id = ?`, single-row fetch) kept
 * returning the oldest row — freezing the connector's tracked_instant. The history window
 * never advanced even though data kept being retrieved.
 *
 * This migration rebuilds every `south_item_cache_*` table with the correct schema
 * (`item_id TEXT PRIMARY KEY`, matching SouthCacheRepository.createItemValueTable), collapsing
 * any duplicate rows to a single row per item_id — keeping the one with the latest
 * tracked_instant (and, for file connectors where tracked_instant is NULL, the most recently
 * written row, via rowid).
 *
 * Idempotent: a table that is already correct is simply rebuilt with one row per item_id.
 */
export async function up(knex: Knex): Promise<void> {
  const tables: Array<{ name: string }> = await knex.raw(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'south_item_cache_%'`
  );

  for (const { name } of tables) {
    const tmpName = `tmp_${name}`;

    // Guard against a leftover temp table from a previously interrupted run.
    await knex.raw(`DROP TABLE IF EXISTS "${tmpName}"`);

    // 1. Create the corrected table (item_id PRIMARY KEY).
    await knex.raw(
      `CREATE TABLE "${tmpName}" (` +
        'item_id TEXT PRIMARY KEY, ' +
        'group_id TEXT, ' +
        'query_time TEXT, ' +
        'value TEXT, ' +
        'tracked_instant TEXT' +
        ')'
    );

    // 2. Copy the surviving row per item_id. Order so that the row kept is the one with the
    //    latest tracked_instant; NULLs sort last under DESC, and rowid DESC breaks ties by
    //    keeping the most recently inserted row (correct for file connectors whose value grows).
    await knex.raw(
      `INSERT INTO "${tmpName}" (item_id, group_id, query_time, value, tracked_instant) ` +
        'SELECT item_id, group_id, query_time, value, tracked_instant FROM (' +
        'SELECT item_id, group_id, query_time, value, tracked_instant, ' +
        'ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY tracked_instant DESC, rowid DESC) AS rn ' +
        `FROM "${name}" WHERE item_id IS NOT NULL` +
        ') WHERE rn = 1'
    );

    // 3. Swap the table in.
    await knex.raw(`DROP TABLE "${name}"`);
    await knex.raw(`ALTER TABLE "${tmpName}" RENAME TO "${name}"`);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
