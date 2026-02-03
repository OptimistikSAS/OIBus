import { Knex } from 'knex';
import path from 'path';

const SOUTH_CACHE_TABLE = 'cache_history';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';

export async function up(knex: Knex): Promise<void> {
  // Connect to the config database (oibus.db) to retrieve connector and item settings.
  // We assume the process current working directory is the data folder (set in index.ts).
  const configKnex = require('knex')({
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(process.cwd(), 'oibus.db')
    },
    useNullAsDefault: true
  });

  try {
    // Get all south connectors from config DB (may not exist in test env)
    let southConnectors: Array<{ id: string; type: string }> = [];
    try {
      southConnectors = await configKnex(SOUTH_CONNECTORS_TABLE).select('id', 'type');
    } catch {
      // Config DB or south_connectors table may not exist (e.g. when running cache DB tests alone)
    }

    for (const connector of southConnectors) {
      const tableName = `south_item_cache_${connector.id}`;

      // Create the new item cache table for this connector (in cache DB)
      await knex.schema.createTable(tableName, table => {
        table.uuid('item_id').primary();
        table.datetime('query_time');
        table.text('value'); // JSON-serialized value
        table.datetime('tracked_instant');
      });

      // Migrate data based on connector type
      if (connector.type === 'folder-scanner') {
        await migrateFolderScanner(knex, configKnex, connector.id, tableName);
      } else if (connector.type === 'ftp') {
        await migrateFtp(knex, configKnex, connector.id, tableName);
      } else if (connector.type === 'sftp') {
        await migrateSftp(knex, configKnex, connector.id, tableName);
      }

      // Migrate tracked_instant from cache_history for all items
      await migrateCacheHistory(knex, connector.id, tableName);
    }

    // Drop old tables
    await dropOldTables(knex, southConnectors);

    // Drop cache_history table
    await knex.schema.dropTableIfExists(SOUTH_CACHE_TABLE);
  } finally {
    await configKnex.destroy();
  }
}

async function migrateFolderScanner(knex: Knex, configKnex: Knex, connectorId: string, newTableName: string): Promise<void> {
  const oldTableName = `folder_scanner_${connectorId}`;

  // Check if old table exists (in cache DB)
  const hasOldTable = await knex.schema.hasTable(oldTableName);
  if (!hasOldTable) {
    return;
  }

  // Get all items for this connector (from config DB)
  const items = await configKnex(SOUTH_ITEMS_TABLE).where('connector_id', connectorId).select('id', 'settings');

  // Get all files from the old table (in cache DB)
  const files = await knex(oldTableName).select('filename', 'mtime_ms');

  // Group files by item based on regex matching
  for (const item of items) {
    const settings = JSON.parse(item.settings);
    const regex = new RegExp(settings.regex || '.*');

    const matchedFiles = files
      .filter(file => file.filename.match(regex))
      .map(file => ({
        filename: file.filename,
        modifiedTime: parseInt(file.mtime_ms, 10)
      }));

    if (matchedFiles.length > 0) {
      await knex(newTableName).insert({
        item_id: item.id,
        query_time: new Date().toISOString(),
        value: JSON.stringify(matchedFiles),
        tracked_instant: null
      });
    }
  }
}

async function migrateFtp(knex: Knex, configKnex: Knex, connectorId: string, newTableName: string): Promise<void> {
  const oldTableName = `south_ftp_${connectorId}`;

  const hasOldTable = await knex.schema.hasTable(oldTableName);
  if (!hasOldTable) {
    return;
  }

  const items = await configKnex(SOUTH_ITEMS_TABLE).where('connector_id', connectorId).select('id', 'settings');
  const files = await knex(oldTableName).select('filename', 'mtime_ms');

  for (const item of items) {
    const settings = JSON.parse(item.settings);
    const regex = new RegExp(settings.regex || '.*');

    const matchedFiles = files
      .filter(file => file.filename.match(regex))
      .map(file => ({
        filename: file.filename,
        modifiedTime: parseInt(file.mtime_ms, 10)
      }));

    if (matchedFiles.length > 0) {
      await knex(newTableName).insert({
        item_id: item.id,
        query_time: new Date().toISOString(),
        value: JSON.stringify(matchedFiles),
        tracked_instant: null
      });
    }
  }
}

async function migrateSftp(knex: Knex, configKnex: Knex, connectorId: string, newTableName: string): Promise<void> {
  const oldTableName = `south_sftp_${connectorId}`;

  const hasOldTable = await knex.schema.hasTable(oldTableName);
  if (!hasOldTable) {
    return;
  }

  const items = await configKnex(SOUTH_ITEMS_TABLE).where('connector_id', connectorId).select('id', 'settings');
  const files = await knex(oldTableName).select('filename', 'mtime_ms');

  for (const item of items) {
    const settings = JSON.parse(item.settings);
    const regex = new RegExp(settings.regex || '.*');

    const matchedFiles = files
      .filter(file => file.filename.match(regex))
      .map(file => ({
        filename: file.filename,
        modifiedTime: parseInt(file.mtime_ms, 10)
      }));

    if (matchedFiles.length > 0) {
      await knex(newTableName).insert({
        item_id: item.id,
        query_time: new Date().toISOString(),
        value: JSON.stringify(matchedFiles),
        tracked_instant: null
      });
    }
  }
}

async function migrateCacheHistory(knex: Knex, connectorId: string, newTableName: string): Promise<void> {
  const hasCacheHistory = await knex.schema.hasTable(SOUTH_CACHE_TABLE);
  if (!hasCacheHistory) {
    return;
  }

  // Get all cache_history entries for this connector
  const cacheEntries = await knex(SOUTH_CACHE_TABLE).where('south_id', connectorId).select('item_id', 'scan_mode_id', 'max_instant');

  for (const entry of cacheEntries) {
    // If item_id is 'all', use the scan_mode_id as the key in the new table
    // Otherwise use the item_id
    const key = entry.item_id === 'all' ? entry.scan_mode_id : entry.item_id;

    // Check if entry already exists in new table
    const existing = await knex(newTableName).where('item_id', key).first();

    if (existing) {
      // Update tracked_instant
      await knex(newTableName).where('item_id', key).update({ tracked_instant: entry.max_instant });
    } else {
      // Insert new entry with just tracked_instant
      await knex(newTableName).insert({
        item_id: key,
        query_time: null,
        value: null,
        tracked_instant: entry.max_instant
      });
    }
  }
}

async function dropOldTables(knex: Knex, southConnectors: Array<{ id: string; type: string }>): Promise<void> {
  for (const connector of southConnectors) {
    if (connector.type === 'folder-scanner') {
      await knex.schema.dropTableIfExists(`folder_scanner_${connector.id}`);
    } else if (connector.type === 'ftp') {
      await knex.schema.dropTableIfExists(`south_ftp_${connector.id}`);
    } else if (connector.type === 'sftp') {
      await knex.schema.dropTableIfExists(`south_sftp_${connector.id}`);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Get all south connectors
  // Drop all item cache tables
  // We need to connect to config DB to get the connectors list
  const configKnex = require('knex')({
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(process.cwd(), 'oibus.db')
    },
    useNullAsDefault: true
  });

  try {
    let southConnectors: Array<{ id: string }> = [];
    try {
      southConnectors = await configKnex(SOUTH_CONNECTORS_TABLE).select('id');
    } catch {
      // Config DB or table may not exist (e.g. in tests)
    }
    for (const connector of southConnectors) {
      const tableName = `south_item_cache_${connector.id}`;
      await knex.schema.dropTableIfExists(tableName);
    }
  } finally {
    await configKnex.destroy();
  }

  // Recreate cache_history table
  await knex.schema.createTable(SOUTH_CACHE_TABLE, table => {
    table.uuid('south_id').notNullable();
    table.uuid('scan_mode_id').notNullable();
    table.uuid('item_id').notNullable();
    table.primary(['south_id', 'scan_mode_id', 'item_id']);
    table.datetime('max_instant');
  });
}
