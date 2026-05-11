import { Knex } from 'knex';

/**
 * Add indexes on the `logs` table to keep UI search and per-connector cleanup
 * fast on databases that have accumulated millions of rows.
 *
 * Hot queries (see backend/src/repository/logs/log.repository.ts):
 *   - search() — always filters `WHERE timestamp BETWEEN ? AND ?` and orders
 *     `ORDER BY timestamp DESC LIMIT 50`. Without an index the engine scans
 *     the whole table and sorts on every page load.
 *   - getScopeById(id) — `WHERE scope_id = ?`.
 *   - deleteLogsByScopeId(type, id) — `WHERE scope_type = ? AND scope_id = ?`.
 *
 * Indexes added:
 *   - idx_logs_timestamp on (timestamp): covers the range filter AND the
 *     DESC ordering (SQLite can traverse an ASC index in reverse). Also helps
 *     the matching `SELECT COUNT(*)` in the paginated search response.
 *   - idx_logs_scope on (scope_id, scope_type): leading column matches
 *     getScopeById's lookup; both columns together cover deleteLogsByScopeId
 *     and any search() call filtered by scope.
 *
 * `CREATE INDEX IF NOT EXISTS` keeps the migration idempotent in case it's
 * re-run against a DB that already received the indexes via some other path.
 *
 * Trade-off note: indexes have an INSERT cost. The logs table is append-only
 * via saveAll(), which already batches inserts in a single transaction — the
 * per-batch index-maintenance cost is small compared to the millisecond-range
 * scans these indexes save on the read side.
 *
 * Message LIKE '%...%' (in search) and scope_name LIKE '%...%' (in
 * suggestScopes) remain unindexable because of the leading wildcard. FTS5
 * would help but is out of scope for this migration.
 */

const LOG_TABLE = 'logs';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ${LOG_TABLE} (timestamp);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_scope ON ${LOG_TABLE} (scope_id, scope_type);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_logs_scope;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_logs_timestamp;`);
}
