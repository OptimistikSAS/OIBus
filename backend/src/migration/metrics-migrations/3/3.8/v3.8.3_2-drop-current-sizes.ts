import { Knex } from 'knex';

const NORTH_METRICS_TABLE = 'north_metrics';
const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';

/**
 * Drop the persisted "current size" gauge columns from the metrics tables.
 *
 * Since the metrics services now read the current cache/error/archive sizes live from the
 * cache service at serialization time, persisting them is redundant: the stored values were
 * always overwritten on read and could only ever be stale. Removing the columns aligns the
 * schema with the "current sizes are live, not persisted" design.
 *
 * - north_metrics: drop current_cache_size, current_error_size, current_archive_size
 * - history_query_metrics: drop north_current_cache_size, north_current_error_size, north_current_archive_size
 *
 * Guards make this idempotent / safe on schemas where the columns are already absent.
 */
export async function up(knex: Knex): Promise<void> {
  const hasNorthCurrent = await knex.schema.hasColumn(NORTH_METRICS_TABLE, 'current_cache_size');
  if (hasNorthCurrent) {
    await knex.schema.alterTable(NORTH_METRICS_TABLE, table => {
      table.dropColumns('current_cache_size', 'current_error_size', 'current_archive_size');
    });
  }

  const hasHistoryCurrent = await knex.schema.hasColumn(HISTORY_QUERY_METRICS_TABLE, 'north_current_cache_size');
  if (hasHistoryCurrent) {
    await knex.schema.alterTable(HISTORY_QUERY_METRICS_TABLE, table => {
      table.dropColumns('north_current_cache_size', 'north_current_error_size', 'north_current_archive_size');
    });
  }
}

export async function down(): Promise<void> {
  return;
}
