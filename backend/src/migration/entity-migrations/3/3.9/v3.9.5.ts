import { Knex } from 'knex';

const COMMANDS_TABLE = 'commands';

/**
 * v3.9.0 split the 'update-engine-settings' OIAnalytics command into 'update-engine-general',
 * 'update-engine-web-server', 'update-engine-proxy' and 'update-engine-logger', but left the existing
 * 'update-engine-settings' rows in place. The repository can no longer map them, so they surfaced as
 * undefined entries and crashed the startup cleanup. They cannot be executed anymore, so drop them.
 */
export async function up(knex: Knex): Promise<void> {
  await knex(COMMANDS_TABLE).where('type', 'update-engine-settings').delete();
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
