import { Knex } from 'knex';

/**
 * Make `south_item_cache.item_id` nullable and collapse existing "batched group" rows onto a
 * single group-keyed row (`item_id = NULL`, `group_id` set).
 *
 * Before this migration, a synced group on a connector that supports batching (i.e. not in
 * `SOUTH_SINGLE_ITEMS`) was cached under the group's *lead* item — `item_id` was the lead item's
 * id, `group_id` the group's id, both set at once. That's the only write path that ever sets both
 * columns together (single-item connectors always write `group_id = NULL`; ungrouped/unsynced
 * items on any connector always write `group_id = NULL` too), so any row with BOTH columns set is
 * unambiguously an old-style batched-group row.
 *
 * That scheme silently orphaned data whenever the lead item changed across restarts (item
 * reordering, item added/removed from the group): a new row would be created keyed to the new
 * lead's id, leaving the old lead's row behind with a stale `tracked_instant` under the same
 * `group_id`. So this migration also collapses any duplicate rows sharing a `group_id`, keeping
 * the one with the latest `tracked_instant`.
 *
 * SQLite can't drop a `NOT NULL` constraint with `ALTER TABLE`, so the table is rebuilt via the
 * same create-tmp/copy/swap approach used by v3.8.0_1.
 *
 * Idempotent: rebuilding an already-nullable, already-collapsed table just copies it as-is.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('south_item_cache'))) return;

  await knex.raw('DROP TABLE IF EXISTS "tmp_south_item_cache"');

  await knex.raw(
    'CREATE TABLE "tmp_south_item_cache" (' +
      'south_id TEXT NOT NULL, ' +
      'item_id TEXT, ' +
      'group_id TEXT, ' +
      'query_time TEXT, ' +
      'value TEXT, ' +
      'tracked_instant TEXT, ' +
      'PRIMARY KEY (south_id, item_id)' +
      ')'
  );

  // Rows with no group_id (ungrouped, unsynced, or single-item-connector rows) are kept as-is,
  // one per (south_id, item_id) already.
  await knex.raw(
    'INSERT INTO "tmp_south_item_cache" (south_id, item_id, group_id, query_time, value, tracked_instant) ' +
      'SELECT south_id, item_id, group_id, query_time, value, tracked_instant FROM "south_item_cache" WHERE group_id IS NULL'
  );

  // Rows with a group_id (old-style batched-group rows, item_id + group_id both set): collapse to
  // one row per (south_id, group_id), item_id nulled out, keeping the latest tracked_instant.
  await knex.raw(
    'INSERT INTO "tmp_south_item_cache" (south_id, item_id, group_id, query_time, value, tracked_instant) ' +
      'SELECT south_id, NULL, group_id, query_time, value, tracked_instant FROM (' +
      'SELECT south_id, group_id, query_time, value, tracked_instant, ' +
      'ROW_NUMBER() OVER (PARTITION BY south_id, group_id ORDER BY tracked_instant DESC, rowid DESC) AS rn ' +
      'FROM "south_item_cache" WHERE group_id IS NOT NULL' +
      ') WHERE rn = 1'
  );

  await knex.raw('DROP TABLE "south_item_cache"');
  await knex.raw('ALTER TABLE "tmp_south_item_cache" RENAME TO "south_item_cache"');
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
