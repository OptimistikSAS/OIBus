import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

interface OldPIItemSettings {
  type?: 'point-id' | 'point-query';
  piPoint?: string;
  piQuery?: string;
  [key: string]: unknown;
}

/**
 * The PI south connector no longer talks to the Windows OIBus Agent over HTTP: it now spawns its own
 * local `OIBusPiAfSdkWindows` child process (via the `@oibus/pi-afsdk-windows` package) instead of a
 * separately installed Windows Service reachable over `agentUrl` — that setting is dropped from both
 * south connectors and history queries. `retryInterval` is untouched: it's still meaningful for the
 * connector's own reconnect policy around the new local connection.
 *
 * Item settings are also simplified: the AF SDK's bulk `PIPoint.FindPIPoints(names)` call resolves an
 * exact tag name and a wildcard search mask identically (see `@oibus/pi-afsdk-windows`'s README), so
 * the old `{type: 'point-id'|'point-query', piPoint?, piQuery?}` split no longer reflects anything
 * real — every item becomes a single `{piPoint}`, taking whichever of the two old fields was actually
 * set (`piQuery` for a former `point-query` item).
 */
export async function up(knex: Knex): Promise<void> {
  await stripAgentUrl(knex, SOUTH_CONNECTORS_TABLE, 'settings', 'type');
  await stripAgentUrl(knex, HISTORY_QUERIES_TABLE, 'south_settings', 'south_type');
  await migrateSouthItemSettings(knex);
  await migrateHistoryItemSettings(knex);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

async function stripAgentUrl(knex: Knex, table: string, settingsColumn: string, typeColumn: string): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(table)
    .select('id', `${settingsColumn} as settings`)
    .where(typeColumn, 'osisoft-pi');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => {
    const { agentUrl: _agentUrl, ...rest } = JSON.parse(settings) as Record<string, unknown>;
    return { id, settings: JSON.stringify(rest) };
  });
  await bulkUpdateSettings(knex, table, settingsColumn, updates);
}

function toNewItemSettings(oldSettings: OldPIItemSettings): { piPoint: string } {
  return { piPoint: oldSettings.piPoint ?? oldSettings.piQuery ?? '' };
}

async function migrateSouthItemSettings(knex: Knex): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(`${SOUTH_ITEMS_TABLE} as si`)
    .join(`${SOUTH_CONNECTORS_TABLE} as sc`, 'sc.id', 'si.connector_id')
    .where('sc.type', 'osisoft-pi')
    .select('si.id', 'si.settings');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => ({
    id,
    settings: JSON.stringify(toNewItemSettings(JSON.parse(settings)))
  }));
  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, 'settings', updates);
}

async function migrateHistoryItemSettings(knex: Knex): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(`${HISTORY_ITEMS_TABLE} as hi`)
    .join(`${HISTORY_QUERIES_TABLE} as hq`, 'hq.id', 'hi.history_id')
    .where('hq.south_type', 'osisoft-pi')
    .select('hi.id', 'hi.settings');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => ({
    id,
    settings: JSON.stringify(toNewItemSettings(JSON.parse(settings)))
  }));
  await bulkUpdateSettings(knex, HISTORY_ITEMS_TABLE, 'settings', updates);
}

/**
 * Writes each `{ id, settings }` pair via chunked `UPDATE ... SET settings = CASE id WHEN ? THEN ? ...
 * END WHERE id IN (...)` statements — the house pattern for bulk-rewriting many rows' JSON settings.
 */
async function bulkUpdateSettings(
  knex: Knex,
  table: string,
  settingsColumn: string,
  updates: Array<{ id: string; settings: string }>
): Promise<void> {
  for (const batch of chunk(updates, 100)) {
    const caseSql = batch.map(() => 'when ? then ?').join(' ');
    const caseBindings = batch.flatMap(u => [u.id, u.settings]);
    await knex(table)
      .whereIn(
        'id',
        batch.map(u => u.id)
      )
      .update({ [settingsColumn]: knex.raw(`case id ${caseSql} end`, caseBindings) });
  }
}

function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
