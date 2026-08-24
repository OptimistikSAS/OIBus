import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

/**
 * The ODBC south connector no longer supports connecting through the Windows OIBus Agent: it now
 * always uses the local `odbc` driver, the same code path `remoteAgent: false` already used. The
 * `remoteAgent`/`agentUrl` toggle is gone, and `retryInterval`/`requestTimeout` go with it since they
 * only existed to configure the agent's reconnect loop and HTTP read timeout — the local driver path
 * doesn't use either.
 *
 * Connectors that had `remoteAgent: true` lose the ability to reach their ODBC agent after this
 * migration and must be reconfigured with a driver installed locally (or reachable through a locally
 * configured DSN), same as any other ODBC connector.
 */
export async function up(knex: Knex): Promise<void> {
  await stripAgentSettings(knex, SOUTH_CONNECTORS_TABLE, 'settings', 'type');
  await stripAgentSettings(knex, HISTORY_QUERIES_TABLE, 'south_settings', 'south_type');
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

async function stripAgentSettings(knex: Knex, table: string, settingsColumn: string, typeColumn: string): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(table)
    .select('id', `${settingsColumn} as settings`)
    .where(typeColumn, 'odbc');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => {
    const {
      remoteAgent: _remoteAgent,
      agentUrl: _agentUrl,
      retryInterval: _retryInterval,
      requestTimeout: _requestTimeout,
      ...rest
    } = JSON.parse(settings) as Record<string, unknown>;
    return { id, settings: JSON.stringify(rest) };
  });

  await bulkUpdateSettings(knex, table, settingsColumn, updates);
}

/**
 * Writes each `{ id, settings }` pair via chunked `UPDATE ... SET settings = CASE id WHEN ? THEN ? ...
 * END WHERE id IN (...)` statements — the house pattern for bulk-rewriting many rows' JSON settings
 * (see 3.10.0_2's `bulkUpdateSettings`), instead of one UPDATE per row.
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
