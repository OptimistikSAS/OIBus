import { Knex } from 'knex';

const SOUTH_CACHE_TABLE = 'cache_history';

export async function up(knex: Knex): Promise<void> {
  // Discover connector IDs from existing cache DB data (no cross-DB access needed).
  const connectorIds = new Set<string>();

  // From cache_history entries
  if (await knex.schema.hasTable(SOUTH_CACHE_TABLE)) {
    const cacheEntries = await knex(SOUTH_CACHE_TABLE).distinct('south_id');
    for (const entry of cacheEntries) {
      connectorIds.add(entry.south_id);
    }
  }

  // From old per-connector tables (folder_scanner_*, south_ftp_*, south_sftp_*)
  const tables: Array<{ name: string }> = await knex.raw(
    `SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'folder_scanner_%' OR name LIKE 'south_ftp_%' OR name LIKE 'south_sftp_%')`
  );
  for (const table of tables) {
    const id = table.name.replace(/^(folder_scanner_|south_ftp_|south_sftp_)/, '');
    connectorIds.add(id);
  }

  // Create per-connector item cache tables and migrate tracked_instant
  for (const connectorId of connectorIds) {
    const tableName = `south_item_cache_${connectorId}`;

    await knex.schema.createTable(tableName, table => {
      table.string('item_id');
      table.string('group_id');
      table.datetime('query_time');
      table.text('value');
      table.datetime('tracked_instant');
      table.unique(['item_id', 'group_id']);
    });

    // Migrate tracked_instant from cache_history
    if (await knex.schema.hasTable(SOUTH_CACHE_TABLE)) {
      const entries = await knex(SOUTH_CACHE_TABLE).where('south_id', connectorId).select('item_id', 'scan_mode_id', 'max_instant');

      for (const entry of entries) {
        const key = entry.item_id === 'all' ? entry.scan_mode_id : entry.item_id;
        await knex(tableName).insert({
          item_id: key,
          query_time: null,
          value: null,
          tracked_instant: entry.max_instant
        });
      }
    }
  }

  // Drop old tables
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table.name);
  }

  // Drop cache_history
  await knex.schema.dropTableIfExists(SOUTH_CACHE_TABLE);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
