import { Knex } from 'knex';

const NORTH_METRICS_TABLE = 'north_metrics';
const SOUTH_METRICS_TABLE = 'south_metrics';
const ENGINE_METRICS_TABLE = 'engine_metrics';
const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';

export async function up(knex: Knex): Promise<void> {
  await removeMetricsTableIfPresent(knex);
}

async function removeMetricsTableIfPresent(knex: Knex): Promise<void> {
  const tables = [NORTH_METRICS_TABLE, SOUTH_METRICS_TABLE, ENGINE_METRICS_TABLE, HISTORY_QUERY_METRICS_TABLE];

  for (const table of tables) {
    // Check if the table exists
    const tableExists = await knex.schema.hasTable(table);

    if (tableExists) {
      // Drop the table if it exists
      await knex.schema.dropTable(table);
    }
  }
}

export async function down(): Promise<void> {
  return;
}
