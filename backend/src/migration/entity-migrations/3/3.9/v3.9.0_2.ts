import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';

// South connector types whose settings gained the new retryInterval field in this migration.
// Neither type supports history queries (see each south's manifest.ts `modes.history`), so there
// is no corresponding south_settings column to backfill in the history_queries table.
const RETRY_INTERVAL_SOUTH_TYPES = ['ftp', 'sftp'];

// Matches the retryInterval default declared in each connector's manifest.ts.
const DEFAULT_RETRY_INTERVAL = 10000;

/**
 * FTP and SFTP south connectors moved from opening a fresh connection per operation to a
 * persistent, auto-reconnecting connection, which needs a retry interval to schedule reconnect
 * attempts with. Existing connectors never had this field, so it's backfilled to 10 000 ms,
 * matching the manifest's default value for newly created connectors.
 */
export async function up(knex: Knex): Promise<void> {
  await addRetryInterval(knex);
}

export async function down(knex: Knex): Promise<void> {
  await removeRetryInterval(knex);
}

async function addRetryInterval(knex: Knex): Promise<void> {
  const southConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .whereIn('type', RETRY_INTERVAL_SOUTH_TYPES);
  for (const southConnector of southConnectors) {
    const settings = JSON.parse(southConnector.settings);
    if (settings.retryInterval === undefined) {
      await knex(SOUTH_CONNECTORS_TABLE)
        .where('id', southConnector.id)
        .update({ settings: JSON.stringify({ ...settings, retryInterval: DEFAULT_RETRY_INTERVAL }) });
    }
  }
}

async function removeRetryInterval(knex: Knex): Promise<void> {
  const southConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .whereIn('type', RETRY_INTERVAL_SOUTH_TYPES);
  for (const southConnector of southConnectors) {
    const { retryInterval: _removed, ...settings } = JSON.parse(southConnector.settings);
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', southConnector.id)
      .update({ settings: JSON.stringify(settings) });
  }
}
