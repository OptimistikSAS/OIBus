import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

interface SouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: {
    aggregate: 'raw' | 'average' | 'minimum' | 'maximum' | 'count';
    resampling?: 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';
  };
  timestampOrigin?: 'oibus' | 'point' | 'server';
}

export async function up(knex: Knex): Promise<void> {
  await updateOPCUAItemHA(knex);
}

async function updateOPCUAItemHA(knex: Knex): Promise<void> {
  const oldItems: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
    .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
    .where(`${SOUTH_CONNECTORS_TABLE}.type`, 'opcua');
  const southSettingsUpdates = oldItems.map(item => {
    const oldSettings = JSON.parse(item.settings) as SouthOPCUAItemSettings;
    const newSettings: SouthOPCUAItemSettings = {
      ...oldSettings,
      haMode: oldSettings.mode === 'ha' ? oldSettings.haMode : undefined,
      timestampOrigin: oldSettings.mode === 'da' ? oldSettings.timestampOrigin : undefined
    };
    return { id: item.id, settings: JSON.stringify(newSettings) };
  });
  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, southSettingsUpdates);

  const oldHistoryItems: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
    .join(HISTORY_QUERIES_TABLE, `${HISTORY_QUERIES_TABLE}.id`, '=', `${HISTORY_ITEMS_TABLE}.history_id`)
    .select(`${HISTORY_ITEMS_TABLE}.id as id`, `${HISTORY_ITEMS_TABLE}.settings as settings`)
    .where(`${HISTORY_QUERIES_TABLE}.south_type`, 'opcua');
  const historySettingsUpdates = oldHistoryItems.map(item => {
    const oldSettings = JSON.parse(item.settings) as SouthOPCUAItemSettings;
    const newSettings: SouthOPCUAItemSettings = {
      ...oldSettings,
      haMode: oldSettings.mode === 'ha' ? oldSettings.haMode : undefined,
      timestampOrigin: oldSettings.mode === 'da' ? oldSettings.timestampOrigin : undefined
    };
    return { id: item.id, settings: JSON.stringify(newSettings) };
  });
  await bulkUpdateSettings(knex, HISTORY_ITEMS_TABLE, historySettingsUpdates);
}

/** Splits `array` into consecutive chunks of at most `size` elements, preserving order. */
function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Writes each `{ id, settings }` pair to `table`'s `settings` column via chunked
 * `UPDATE ... SET settings = CASE id WHEN ? THEN ? ... END WHERE id IN (...)` statements instead of
 * one UPDATE per row, cutting N sequential UPDATE statements down to N/100 while producing the exact
 * same per-row values.
 */
async function bulkUpdateSettings(knex: Knex, table: string, updates: Array<{ id: string; settings: string }>): Promise<void> {
  for (const batch of chunk(updates, 100)) {
    const caseSql = batch.map(() => 'when ? then ?').join(' ');
    const caseBindings = batch.flatMap(u => [u.id, u.settings]);
    await knex(table)
      .whereIn(
        'id',
        batch.map(u => u.id)
      )
      .update({ settings: knex.raw(`case id ${caseSql} end`, caseBindings) });
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
