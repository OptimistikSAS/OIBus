import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

/**
 * The OPC Classic (DA/HDA) south connector no longer talks to the Windows OIBus Agent over HTTP: it
 * now spawns its own local `OIBusOpcClassicWindows` child process (via the `@oibus/opc-classic`
 * package) instead of a separately installed Windows Service reachable over `agentUrl` — that
 * setting is dropped from both south connectors and history queries.
 * `host`/`serverName`/`mode`/`retryInterval` are untouched: they're still meaningful for the
 * connector's own target and reconnect policy around the new local connection. Item settings
 * (`nodeId`/`aggregate`/`resampling`) are unchanged by this port — the DA/HDA/browse fork lives
 * entirely in the new package, not in the item shape.
 */
export async function up(knex: Knex): Promise<void> {
  await stripAgentUrl(knex, SOUTH_CONNECTORS_TABLE, 'settings', 'type');
  await stripAgentUrl(knex, HISTORY_QUERIES_TABLE, 'south_settings', 'south_type');
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

async function stripAgentUrl(knex: Knex, table: string, settingsColumn: string, typeColumn: string): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(table)
    .select('id', `${settingsColumn} as settings`)
    .where(typeColumn, 'opc');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => {
    const { agentUrl: _agentUrl, ...rest } = JSON.parse(settings) as Record<string, unknown>;
    return { id, settings: JSON.stringify(rest) };
  });
  await bulkUpdateSettings(knex, table, settingsColumn, updates);
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
