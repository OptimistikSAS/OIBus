import path from 'node:path';

import { Knex } from 'knex';
import Database from 'better-sqlite3';

const SOUTH_CACHE_TABLE = 'cache_history';
const MIGRATION_HINTS_TABLE = '_migration_v380_file_connector_hints';

export async function up(knex: Knex): Promise<void> {
  // 1. Discover connector IDs from existing cache_history entries
  const connectorIds = new Set<string>();
  if (await knex.schema.hasTable(SOUTH_CACHE_TABLE)) {
    const cacheEntries = await knex(SOUTH_CACHE_TABLE).distinct('south_id');
    for (const entry of cacheEntries) {
      connectorIds.add(entry.south_id);
    }
  }

  // 2. Read old per-connector file tables BEFORE dropping them — they hold the preserved file lists
  const oldFileTables: Array<{ name: string }> = await knex.raw(
    `SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'folder_scanner_%' OR name LIKE 'south_ftp_%' OR name LIKE 'south_sftp_%')`
  );

  const preservedFilesByConnector = new Map<string, Array<{ filename: string; modifiedTime: number }>>();
  for (const table of oldFileTables) {
    const connectorId = table.name.replace(/^(folder_scanner_|south_ftp_|south_sftp_)/, '');
    connectorIds.add(connectorId);

    const rows: Array<{ filename: string; mtime_ms: number }> = await knex.raw(`SELECT filename, mtime_ms FROM "${table.name}"`);
    preservedFilesByConnector.set(
      connectorId,
      rows.map(r => ({ filename: r.filename, modifiedTime: r.mtime_ms }))
    );
  }

  // 3. Create per-connector item cache tables and migrate tracked_instant from cache_history
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

    if (await knex.schema.hasTable(SOUTH_CACHE_TABLE)) {
      const entries = await knex(SOUTH_CACHE_TABLE).where('south_id', connectorId).select('item_id', 'scan_mode_id', 'max_instant');

      for (const entry of entries) {
        const key = entry.item_id === 'all' ? entry.scan_mode_id : entry.item_id;
        await knex(tableName).insert({ item_id: key, query_time: null, value: null, tracked_instant: entry.max_instant });
      }
    }
  }

  // 4. Drop old tables now that their data has been collected
  for (const table of oldFileTables) {
    await knex.schema.dropTableIfExists(table.name);
  }
  await knex.schema.dropTableIfExists(SOUTH_CACHE_TABLE);

  // 5. Populate filesPreserved for file-connector items using the hints table written by the entity migration.
  //    Using better-sqlite3 directly with fileMustExist:true so that oibus.db is never created as a side effect
  //    (e.g. in tests). By the time this cache migration runs, the entity migration has already committed and
  //    closed its connection, so there is no concurrency risk.
  const entityDbPath = path.resolve('oibus.db');
  let entityDb: Database.Database | null = null;
  try {
    entityDb = new Database(entityDbPath, { fileMustExist: true });

    const hintsExist = entityDb.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(MIGRATION_HINTS_TABLE);
    if (!hintsExist) return;

    const hints = entityDb.prepare(`SELECT connector_id, item_id, preserve_files, regex FROM "${MIGRATION_HINTS_TABLE}"`).all() as Array<{
      connector_id: string;
      item_id: string;
      preserve_files: number;
      regex: string;
    }>;

    // Drop the hints table — it has served its purpose
    entityDb.prepare(`DROP TABLE "${MIGRATION_HINTS_TABLE}"`).run();

    for (const hint of hints) {
      if (!hint.preserve_files) continue;

      const connectorFiles = preservedFilesByConnector.get(hint.connector_id);
      if (!connectorFiles || connectorFiles.length === 0) continue;

      // Filter the connector-level file list down to files matching this item's regex
      const filesPreserved = connectorFiles.filter(f => f.filename.match(hint.regex));
      if (filesPreserved.length === 0) continue;

      const tableName = `south_item_cache_${hint.connector_id}`;
      if (!(await knex.schema.hasTable(tableName))) continue;

      const existing = await knex(tableName).where('item_id', hint.item_id).whereNull('group_id').first();
      if (existing) {
        await knex(tableName)
          .where('item_id', hint.item_id)
          .whereNull('group_id')
          .update({ value: JSON.stringify(filesPreserved) });
      } else {
        await knex(tableName).insert({
          item_id: hint.item_id,
          group_id: null,
          query_time: null,
          value: JSON.stringify(filesPreserved),
          tracked_instant: null
        });
      }
    }
  } catch {
    // oibus.db not accessible or hints table absent — file connectors will rebuild their cache on first scan
  } finally {
    entityDb?.close();
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
