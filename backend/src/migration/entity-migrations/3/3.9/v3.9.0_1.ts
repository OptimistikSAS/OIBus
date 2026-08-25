import { Knex } from 'knex';
import { addOpcuaMaxParallelRun as applyOpcuaMaxParallelRun } from '../../../../service/config-transfer/settings-upgrades/3.9/v3.9.0';

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
 *
 * The actual backfill logic lives in the shared, DB-agnostic settings-upgrade registry
 * (`applyOpcuaMaxParallelRun`) so the config-import upgrade pipeline can apply the exact same
 * rewrite to an older exported settings blob instead of duplicating it here.
 */
async function addOpcuaMaxParallelRun(knex: Knex): Promise<void> {
  const southConnectors: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'opcua');
  for (const southConnector of southConnectors) {
    const settings = JSON.parse(southConnector.settings);
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', southConnector.id)
      .update({ settings: JSON.stringify(applyOpcuaMaxParallelRun(settings)) });
  }

  const historyQueries: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .where('south_type', 'opcua');
  for (const historyQuery of historyQueries) {
    const southSettings = JSON.parse(historyQuery.south_settings);
    await knex(HISTORY_QUERIES_TABLE)
      .where('id', historyQuery.id)
      .update({ south_settings: JSON.stringify(applyOpcuaMaxParallelRun(southSettings)) });
  }
}

// down() keeps its own inline inverse rather than calling back into the settings-upgrade
// registry: the registry is forward-only (import upgrades never need to run backwards, per the
// issue's "no downgrade support"), so there is no shared "un-apply" function to delegate to here.
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
