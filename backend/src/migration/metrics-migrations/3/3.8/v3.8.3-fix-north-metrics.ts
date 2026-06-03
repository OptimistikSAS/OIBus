import { Knex } from 'knex';

const NORTH_METRICS_TABLE = 'north_metrics';
const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';

/**
 * Repair migration for metrics tables affected by the broken v3.6.0 migration.
 *
 * ## north_metrics
 *
 * v3.6.0 tried to drop 'nb_values_sent', 'nb_files_sent', 'last_value_sent', 'last_file_sent'
 * from north_metrics, but the actual column names (set by v3.0-initial-setup) had no '_sent'
 * suffix. Only 'cache_size' (correct) was dropped; the other four columns were silently left
 * behind because they were not in the list.
 *
 * Additionally, north connector rows created by 3.7.x code whose initMetrics INSERT did not
 * include the columns added by v3.6.0 have NULL for those columns. Setting them to 0 restores
 * the invariant that all numeric metric columns are never NULL (matching the TypeScript types).
 *
 * ## history_query_metrics
 *
 * v3.6.0 correctly dropped the four '_sent' columns (the names match the v3.5.0 schema),
 * but did not drop the three size columns added by v3.5.0 that were superseded by the new
 * 'north_current_*' columns: 'north_cache_size', 'north_error_size', 'north_archive_size'.
 * Same NULL-initialization risk for the seven integer columns added by v3.6.0.
 */
export async function up(knex: Knex): Promise<void> {
  // ── north_metrics ────────────────────────────────────────────────────────

  // 1a. Drop the four columns v3.6.0 failed to remove (wrong names).
  //     Guard against fresh installs where v3.6.0 already ran with the fix.
  const hasNbValues = await knex.schema.hasColumn(NORTH_METRICS_TABLE, 'nb_values');
  if (hasNbValues) {
    await knex.schema.alterTable(NORTH_METRICS_TABLE, table => {
      table.dropColumns('nb_values', 'nb_files', 'last_value', 'last_file');
    });
  }

  // 1b. Set NULL numeric columns to 0 for rows pre-dating the ADD COLUMN step.
  await knex(NORTH_METRICS_TABLE)
    .whereNull('content_sent_size')
    .orWhereNull('content_cached_size')
    .orWhereNull('content_errored_size')
    .orWhereNull('content_archived_size')
    .orWhereNull('current_cache_size')
    .orWhereNull('current_error_size')
    .orWhereNull('current_archive_size')
    .update({
      content_sent_size: knex.raw('COALESCE(content_sent_size, 0)'),
      content_cached_size: knex.raw('COALESCE(content_cached_size, 0)'),
      content_errored_size: knex.raw('COALESCE(content_errored_size, 0)'),
      content_archived_size: knex.raw('COALESCE(content_archived_size, 0)'),
      current_cache_size: knex.raw('COALESCE(current_cache_size, 0)'),
      current_error_size: knex.raw('COALESCE(current_error_size, 0)'),
      current_archive_size: knex.raw('COALESCE(current_archive_size, 0)')
    });

  // ── history_query_metrics ─────────────────────────────────────────────────

  // 2a. Drop the three superseded size columns that v3.6.0 did not include in its drop list.
  const hasNorthCacheSize = await knex.schema.hasColumn(HISTORY_QUERY_METRICS_TABLE, 'north_cache_size');
  if (hasNorthCacheSize) {
    await knex.schema.alterTable(HISTORY_QUERY_METRICS_TABLE, table => {
      table.dropColumns('north_cache_size', 'north_error_size', 'north_archive_size');
    });
  }

  // 2b. Set NULL numeric columns to 0.
  await knex(HISTORY_QUERY_METRICS_TABLE)
    .whereNull('content_sent_size')
    .orWhereNull('content_cached_size')
    .orWhereNull('content_errored_size')
    .orWhereNull('content_archived_size')
    .orWhereNull('north_current_cache_size')
    .orWhereNull('north_current_error_size')
    .orWhereNull('north_current_archive_size')
    .update({
      content_sent_size: knex.raw('COALESCE(content_sent_size, 0)'),
      content_cached_size: knex.raw('COALESCE(content_cached_size, 0)'),
      content_errored_size: knex.raw('COALESCE(content_errored_size, 0)'),
      content_archived_size: knex.raw('COALESCE(content_archived_size, 0)'),
      north_current_cache_size: knex.raw('COALESCE(north_current_cache_size, 0)'),
      north_current_error_size: knex.raw('COALESCE(north_current_error_size, 0)'),
      north_current_archive_size: knex.raw('COALESCE(north_current_archive_size, 0)')
    });
}

export async function down(): Promise<void> {
  return;
}
