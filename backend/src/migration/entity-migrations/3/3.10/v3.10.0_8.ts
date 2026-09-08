import { Knex } from 'knex';

const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const WORKFLOW_RUNS_TABLE = 'workflow_runs';

/**
 * Adds the two columns `oianalytics_messages` needs for a remote (push-to-OIAnalytics) Configuration
 * Workflow run's own message type (`configuration-workflow-result`):
 *
 *  - `workflow_run_id` — which run this message carries the result of; `ON DELETE CASCADE` since a
 *    message with no run left to report on has nothing meaningful left to send.
 *  - `payload` — the message's own JSON body, built once at run time and sent verbatim. Unlike
 *    `full-config`/`history-queries` (which recompute their payload from the *current* configuration
 *    at send time — see `OIAnalyticsMessageService`'s own comment on why they don't store one), a
 *    workflow run's discovered records are a one-off snapshot that can't be recomputed later without
 *    re-running discovery, so this message type must store it directly.
 *
 * Both nullable, since neither applies to `full-config`/`history-queries` messages. Uses raw
 * single-statement `ALTER TABLE ... ADD COLUMN` (an in-place metadata change on SQLite) instead of
 * knex's schema builder, for the same reason already documented in v3.10.0_5.ts: adding a column with a
 * `.references()` FK via knex's builder rebuilds the whole table, which can fail if some other table's
 * live FK already points into it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" ADD COLUMN "workflow_run_id" varchar(36) REFERENCES "${WORKFLOW_RUNS_TABLE}" ("id") ON DELETE CASCADE`
  );
  await knex.raw(`ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" ADD COLUMN "payload" text`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" DROP COLUMN "workflow_run_id"`);
  await knex.raw(`ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" DROP COLUMN "payload"`);
}
