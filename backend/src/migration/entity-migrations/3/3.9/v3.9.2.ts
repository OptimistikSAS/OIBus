import { Knex } from 'knex';
import { removeEmptyTimestampOrigin } from '../../../../service/config-transfer/config-upgrades/3.9/v3.9.2';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

/**
 * Older versions initialized OPC UA items' `settings.timestampOrigin` to an empty string instead of
 * omitting it, even though it's only meaningful for 'da'-mode items (it's hidden in the form for
 * 'ha' mode). The field is a strict 'oibus' | 'point' | 'server' enum, so a stored '' fails
 * validation as soon as the connector or history query is saved, blocking any edit to it. Strip the
 * stray empty value so existing items validate again, matching what the UI itself sends today.
 *
 * Shared with the config upgrade of the same version (applied to imported configurations).
 */
export async function up(knex: Knex): Promise<void> {
  const opcuaConnectorIds = knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', 'opcua');
  const southItems: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .select('id', 'settings')
    .whereIn('connector_id', opcuaConnectorIds);
  for (const item of southItems) {
    const settings = JSON.parse(item.settings) as Record<string, unknown>;
    const upgraded = removeEmptyTimestampOrigin(settings);
    if (upgraded !== settings) {
      await knex(SOUTH_ITEMS_TABLE)
        .where('id', item.id)
        .update({ settings: JSON.stringify(upgraded) });
    }
  }

  const opcuaHistoryQueryIds = knex(HISTORY_QUERIES_TABLE).select('id').where('south_type', 'opcua');
  const historyItems: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
    .select('id', 'settings')
    .whereIn('history_id', opcuaHistoryQueryIds);
  for (const item of historyItems) {
    const settings = JSON.parse(item.settings) as Record<string, unknown>;
    const upgraded = removeEmptyTimestampOrigin(settings);
    if (upgraded !== settings) {
      await knex(HISTORY_ITEMS_TABLE)
        .where('id', item.id)
        .update({ settings: JSON.stringify(upgraded) });
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
