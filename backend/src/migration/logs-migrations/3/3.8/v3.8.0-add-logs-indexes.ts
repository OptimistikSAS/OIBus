import { Knex } from 'knex';

/**
 * One-time DB-shape upgrades for the logs database. Two unrelated things, but
 * both are "configure SQLite so the application doesn't have to manage it":
 *
 * 1. Indexes for the hot read/delete paths in log.repository.ts.
 *    - idx_logs_timestamp covers `WHERE timestamp BETWEEN ?` + `ORDER BY
 *      timestamp DESC LIMIT 50` (every UI search) and the matching COUNT(*).
 *    - idx_logs_scope (scope_id, scope_type) covers getScopeById (leading
 *      column) and deleteLogsByScopeId (both columns).
 *
 * 2. Auto-vacuum mode = FULL.
 *    Original code ran a full `VACUUM` on every OIBus boot (sqlite-transport.ts
 *    line 41) AND after every Nth deletion burst. Setting auto-vacuum to FULL
 *    flips that around: SQLite reclaims free pages itself, as part of any
 *    transaction that frees them, so the application no longer needs vacuum
 *    code at all.
 *    Caveats:
 *      - Setting auto_vacuum on an existing non-empty DB is a no-op without a
 *        subsequent VACUUM. The migration runs VACUUM once here; subsequent
 *        boots see mode 1 and have nothing to do.
 *      - VACUUM cannot run inside a transaction (see `config` below).
 *      - Per-INSERT overhead is small (one ptrmap page touched). For logs —
 *        append-heavy, rare bulk deletes — this is the right trade vs the
 *        previous "boot-time multi-second full vacuum" pattern.
 *
 * `CREATE INDEX IF NOT EXISTS` makes the index part idempotent; the
 * auto-vacuum part is naturally idempotent (PRAGMA + VACUUM converges to the
 * same end state regardless of how often it runs).
 *
 * Message LIKE '%...%' (search) and scope_name LIKE '%...%' (suggestScopes)
 * remain unindexable because of the leading wildcard. FTS5 would help but is
 * out of scope here.
 */

const LOG_TABLE = 'logs';

/**
 * Disable Knex's wrapping transaction for this migration: `VACUUM` is not
 * permitted inside an active transaction. PRAGMA + CREATE INDEX are both
 * idempotent and safe to run unwrapped, so we lose nothing.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON ${LOG_TABLE} (timestamp);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_scope ON ${LOG_TABLE} (scope_id, scope_type);`);

  // Setting auto_vacuum is a no-op on a non-empty DB without a subsequent
  // VACUUM — order matters. Future inserts/deletes will then self-maintain.
  await knex.raw('PRAGMA auto_vacuum = FULL;');
  await knex.raw('VACUUM;');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_logs_scope;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_logs_timestamp;`);
  // Reverting auto_vacuum requires another full VACUUM; we deliberately don't
  // undo it here because (a) the index drop is the meaningful rollback and
  // (b) staying in FULL mode is harmless for older versions of the code.
}
