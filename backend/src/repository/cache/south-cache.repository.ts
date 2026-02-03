import { Database } from 'better-sqlite3';
import { SouthCache, SouthItemLastValue } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

/**
 * Repository used for South connector cache (Scan mode instant storage)
 *
 * Each South connector now has its own cache table (south_item_cache_{southId})
 * instead of using a single global cache_history table.
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  getSouthCache(southId: string, scanModeId: string, itemId: string): SouthCache | null {
    // Determine key: if itemId is 'all', use scanModeId, otherwise use itemId
    const key = itemId === 'all' ? scanModeId : itemId;
    const itemValue = this.getItemLastValue(southId, key);

    if (!itemValue) return null;

    return {
      southId,
      scanModeId,
      itemId,
      maxInstant: itemValue.trackedInstant || ''
    };
  }

  save(command: SouthCache): void {
    const key = command.itemId === 'all' ? command.scanModeId : command.itemId;
    this.saveItemLastValue(command.southId, {
      itemId: key, // Use correct key logic
      queryTime: null,
      value: null,
      trackedInstant: command.maxInstant
    });
  }

  /**
   * @deprecated Use getAllItemValues and filter/aggregate in service
   */
  getLatestMaxInstants(_southId: string): Map<string, Instant> | null {
    return null;
  }

  delete(southId: string, scanModeId: string, itemId: string): void {
    const key = itemId === 'all' ? scanModeId : itemId;
    this.deleteItemValue(southId, key);
  }

  deleteAllBySouthConnector(southId: string): void {
    this.dropItemValueTable(southId);
  }

  deleteAllBySouthItem(_itemId: string): void {
    // No-op: Requires southId which is not provided.
    // SouthConnector now uses deleteItemValue(southId, itemId) directly.
  }

  deleteAllByScanMode(_scanModeId: string): void {
    // No-op: Incompatible with per-connector tables.
  }

  createCustomTable(tableName: string, fields: string): void {
    this._database.prepare(`CREATE TABLE IF NOT EXISTS "${tableName}" (${fields});`).run();
  }

  runQueryOnCustomTable(query: string, params: Array<string | number>): void {
    this._database.prepare(query).run(...params);
  }

  getQueryOnCustomTable(query: string, params: Array<string | number>): unknown {
    return this._database.prepare(query).get(...params);
  }

  /**
   * Create item value table for a connector
   */
  createItemValueTable(connectorId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    this._database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "${tableName}" (` +
          'item_id TEXT PRIMARY KEY, ' +
          'query_time TEXT, ' +
          'value TEXT, ' +
          'tracked_instant TEXT' +
          ');'
      )
      .run();
  }

  /**
   * Drop item value table for a connector
   */
  dropItemValueTable(connectorId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    this._database.prepare(`DROP TABLE IF EXISTS "${tableName}";`).run();
  }

  /**
   * Get last value for an item
   */
  getItemLastValue(connectorId: string, itemId: string): SouthItemLastValue | null {
    const tableName = `south_item_cache_${connectorId}`;
    // Check if table exists first? No, we assume table exists (created on start)
    // However, if table doesn't exist, this might throw?
    // better-sqlite3 throws if table not found? Yes.
    // So createItemValueTable on start is CRITICAL.
    const query = `SELECT item_id, query_time, value, tracked_instant FROM "${tableName}" WHERE item_id = ?;`;
    try {
      const result = this._database.prepare(query).get(itemId) as Record<string, string> | undefined;
      if (!result) return null;
      return this.toSouthItemLastValue(result);
    } catch {
      // Table might not exist if cache never initialized or deleted
      return null;
    }
  }

  /**
   * Get all item values for a connector
   */
  getAllItemValues(connectorId: string): Array<SouthItemLastValue> {
    const tableName = `south_item_cache_${connectorId}`;
    const query = `SELECT item_id, query_time, value, tracked_instant FROM "${tableName}";`;
    try {
      const results = this._database.prepare(query).all() as Array<Record<string, string>>;
      return results.map(result => this.toSouthItemLastValue(result));
    } catch {
      return [];
    }
  }

  /**
   * Save or update item last value
   */
  saveItemLastValue(connectorId: string, command: SouthItemLastValue): void {
    const tableName = `south_item_cache_${connectorId}`;
    const existing = this.getItemLastValue(connectorId, command.itemId);

    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;

    if (!existing) {
      const insertQuery = `INSERT INTO "${tableName}" (item_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(command.itemId, command.queryTime, valueStr, command.trackedInstant);
    } else {
      const updateQuery = `UPDATE "${tableName}" SET query_time = ?, value = ?, tracked_instant = ? WHERE item_id = ?;`;
      this._database.prepare(updateQuery).run(command.queryTime, valueStr, command.trackedInstant, command.itemId);
    }
  }

  /**
   * Delete item value
   */
  deleteItemValue(connectorId: string, itemId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    const query = `DELETE FROM "${tableName}" WHERE item_id = ?;`;
    try {
      this._database.prepare(query).run(itemId);
    } catch {
      // Ignore if table/item fails
    }
  }

  private toSouthItemLastValue(result: Record<string, string>): SouthItemLastValue {
    let parsedValue: unknown = null;
    if (result.value) {
      try {
        parsedValue = JSON.parse(result.value);
      } catch {
        parsedValue = result.value;
      }
    }

    return {
      itemId: result.item_id,
      queryTime: result.query_time || null,
      value: parsedValue,
      trackedInstant: result.tracked_instant || null
    };
  }
}
