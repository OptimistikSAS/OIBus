import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';

interface SouthOPCUAItemSettingsHaMode {
  aggregate: 'raw' | 'average' | 'minimum' | 'maximum' | 'count';
  resampling?: 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';
}

interface OldSouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: SouthOPCUAItemSettingsHaMode | null;
}

interface NewSouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: SouthOPCUAItemSettingsHaMode | null;
  timestampOrigin: string;
}

export async function up(knex: Knex): Promise<void> {
  await updateSouthOPCUAItemSettings(knex);
}

async function updateSouthOPCUAItemSettings(knex: Knex) {
  const items: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
    .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
    .where(`${SOUTH_CONNECTORS_TABLE}.type`, 'opcua');

  const settingsUpdates: Array<{ id: string; settings: string }> = [];
  for (const item of items) {
    const oldItemSettings: OldSouthOPCUAItemSettings = JSON.parse(item.settings);
    if (oldItemSettings.mode === 'da') {
      const newItemSettings: NewSouthOPCUAItemSettings = {
        ...oldItemSettings,
        timestampOrigin: 'oibus'
      };
      settingsUpdates.push({ id: item.id, settings: JSON.stringify(newItemSettings) });
    }
  }
  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, settingsUpdates);
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
