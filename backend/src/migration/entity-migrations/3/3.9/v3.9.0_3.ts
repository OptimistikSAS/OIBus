import { Knex } from 'knex';

const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Scan modes gained a second scheduling mechanism: besides a cron expression they can now tick on a
 * fixed interval. Every scan mode created before this migration was cron-driven, so `type` is
 * backfilled to 'cron' and `interval` stays null — behavior is unchanged after upgrading.
 *
 * `activation_window` is a new optional gate (JSON: an absolute date range and/or a recurring
 * day-of-week + time-of-day rule with its IANA timezone) evaluated on every tick. Null means
 * "always active", which is the pre-existing behavior, so nothing is backfilled.
 *
 * The columns are added nullable and then backfilled rather than declared NOT NULL: SQLite cannot
 * add a NOT NULL column to a populated table without a default, and the repository is the only
 * write path, so it enforces the invariant instead.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SCAN_MODES_TABLE, table => {
    table.string('type');
    table.string('interval');
    table.string('activation_window');
  });

  // Includes the reserved 'subscription' row, whose empty cron is never scheduled anyway.
  await knex(SCAN_MODES_TABLE).update({ type: 'cron' });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SCAN_MODES_TABLE, table => {
    table.dropColumn('type');
    table.dropColumn('interval');
    table.dropColumn('activation_window');
  });
}
