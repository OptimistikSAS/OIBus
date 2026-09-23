import { Knex } from 'knex';

const ENGINES_TABLE = 'engines';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

/**
 * Add auth_token_duration to engines, storing the same jsonwebtoken `expiresIn` duration string
 * ('1h', '6h', '1d', '3d', '7d', '14d', '30d') passed straight through at sign time. Matches the
 * previously hardcoded '7d' JWT expiresIn — existing installs keep the same session length after
 * upgrading.
 *
 * Also adds forward_proxy_enabled: previously, forwarding to an upstream proxy was implicitly
 * active whenever forward_proxy_url was set. This backfills the new explicit flag from that
 * existing data so behavior is unchanged after upgrading.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.string('auth_token_duration');
    t.integer('forward_proxy_enabled');
  });
  await knex(ENGINES_TABLE).update({
    auth_token_duration: '7d'
  });
  await knex(ENGINES_TABLE).whereNotNull('forward_proxy_url').update({ forward_proxy_enabled: 1 });
  await knex(ENGINES_TABLE).whereNull('forward_proxy_url').update({ forward_proxy_enabled: 0 });

  await addOpcuaMaxParallelRun(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.dropColumn('auth_token_duration');
    t.dropColumn('forward_proxy_enabled');
  });

  await removeOpcuaMaxParallelRun(knex);
}

/**
 * The OPC UA south settings gained a required maxParallelRun field (how many HA node reads can run
 * concurrently). Existing connectors/history queries never had it, so it's backfilled to 1 — a
 * single sequential read at a time, matching the behavior before this setting existed.
 */
async function addOpcuaMaxParallelRun(knex: Knex): Promise<void> {
  const southConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'opcua');
  for (const southConnector of southConnectors) {
    const settings = JSON.parse(southConnector.settings);
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', southConnector.id)
      .update({ settings: JSON.stringify({ ...settings, maxParallelRun: 1 }) });
  }

  const historyQueries: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .where('south_type', 'opcua');
  for (const historyQuery of historyQueries) {
    const southSettings = JSON.parse(historyQuery.south_settings);
    await knex(HISTORY_QUERIES_TABLE)
      .where('id', historyQuery.id)
      .update({ south_settings: JSON.stringify({ ...southSettings, maxParallelRun: 1 }) });
  }
}

async function removeOpcuaMaxParallelRun(knex: Knex): Promise<void> {
  const southConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'opcua');
  for (const southConnector of southConnectors) {
    const { maxParallelRun: _removed, ...settings } = JSON.parse(southConnector.settings);
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', southConnector.id)
      .update({ settings: JSON.stringify(settings) });
  }

  const historyQueries: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .where('south_type', 'opcua');
  for (const historyQuery of historyQueries) {
    const { maxParallelRun: _removed, ...southSettings } = JSON.parse(historyQuery.south_settings);
    await knex(HISTORY_QUERIES_TABLE)
      .where('id', historyQuery.id)
      .update({ south_settings: JSON.stringify(southSettings) });
  }
}
