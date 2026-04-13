import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

const SOUTH_CACHE_TABLE = 'cache_history';

async function listFilesRecursively(dirPath: string, baseDir: string, recursive: boolean): Promise<Array<string>> {
  const files: Array<string> = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await listFilesRecursively(fullPath, baseDir, recursive)));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files;
}

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

  // Populate filesPreserved for folder-scanner connectors migrating from v3.7.
  // The entity DB is accessible via ATTACH because OIBus chdirs to the data folder before running migrations.
  try {
    await knex.raw("ATTACH DATABASE 'oibus.db' AS entity_db");

    const folderScanners: Array<{ id: string; settings: string }> = await knex.raw(
      "SELECT id, settings FROM entity_db.south_connectors WHERE type = 'folder-scanner'"
    );

    for (const connector of folderScanners) {
      const connectorSettings: { inputFolder: string } = JSON.parse(connector.settings);
      const tableName = `south_item_cache_${connector.id}`;
      if (!(await knex.schema.hasTable(tableName))) continue;

      const items: Array<{ id: string; settings: string }> = await knex.raw(
        'SELECT id, settings FROM entity_db.south_items WHERE connector_id = ?',
        [connector.id]
      );

      for (const item of items) {
        const itemSettings: { preserveFiles: boolean; regex: string; recursive: boolean } = JSON.parse(item.settings);
        if (!itemSettings.preserveFiles) continue;

        const cacheEntry = await knex(tableName)
          .where('item_id', item.id)
          .whereNull('group_id')
          .whereNull('value')
          .whereNotNull('tracked_instant')
          .first();
        if (!cacheEntry) continue;

        const cutoffMs = new Date(cacheEntry.tracked_instant).getTime();
        const inputFolder = path.resolve(connectorSettings.inputFolder);
        const filesPreserved: Array<{ filename: string; modifiedTime: number }> = [];

        try {
          const allFiles = await listFilesRecursively(inputFolder, inputFolder, itemSettings.recursive);
          for (const file of allFiles.filter(f => f.match(itemSettings.regex))) {
            const stats = await fs.stat(path.join(inputFolder, file));
            if (stats.mtimeMs <= cutoffMs) {
              filesPreserved.push({ filename: file, modifiedTime: stats.mtimeMs });
            }
          }
        } catch {
          // Input folder inaccessible reset to fresh state so connector re-processes on next scan
          await knex(tableName).where('item_id', item.id).whereNull('group_id').update({ tracked_instant: null });
          continue;
        }

        await knex(tableName)
          .where('item_id', item.id)
          .whereNull('group_id')
          .update({ value: JSON.stringify(filesPreserved) });
      }
    }

    await knex.raw('DETACH DATABASE entity_db');
  } catch {
    // Entity DB not available folder-scanner connectors will re-process files on first run after migration
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
