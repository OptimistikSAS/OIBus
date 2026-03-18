import { Database } from 'better-sqlite3';
import { SouthItemLastValue } from '../../../shared/model/south-connector.model';

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

  /**
   * Create an item value table for a connector
   */
  createItemValueTable(connectorId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    this._database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "${tableName}" (` +
          'item_id TEXT PRIMARY KEY, ' +
          'group_id TEXT, ' +
          'query_time TEXT, ' +
          'value TEXT, ' +
          'tracked_instant TEXT' +
          ');'
      )
      .run();
  }

  /**
   * Drop the item value table for a connector
   */
  dropItemValueTable(connectorId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    this._database.prepare(`DROP TABLE IF EXISTS "${tableName}";`).run();
  }

  /**
   * Get last value for an item
   */
  getItemLastValue(connectorId: string, groupId: string | null, itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null {
    const tableName = `south_item_cache_${connectorId}`;
    let whereClause = 'WHERE item_id = ?';
    const queryParams = [itemId];
    if (groupId) {
      whereClause += ` AND group_id = ?`;
      queryParams.push(groupId);
    }
    const query = `SELECT group_id, item_id, query_time, value, tracked_instant FROM "${tableName}" ${whereClause};`;
    try {
      const result = this._database.prepare(query).get(...queryParams) as Record<string, string> | undefined;
      if (!result) return null;
      return this.toSouthItemLastValue(result);
    } catch {
      // Table might not exist if cache never initialized or deleted
      return null;
    }
  }

  /**
   * Save or update the last item value
   */
  saveItemLastValue(connectorId: string, command: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void {
    const tableName = `south_item_cache_${connectorId}`;
    const existing = this.getItemLastValue(connectorId, command.groupId, command.itemId);

    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;

    if (!existing) {
      const insertQuery = `INSERT INTO "${tableName}" (group_id, item_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(command.groupId, command.itemId, command.queryTime, valueStr, command.trackedInstant);
    } else {
      const updateQuery = `UPDATE "${tableName}" SET query_time = ?, value = ?, tracked_instant = ? WHERE group_id = ? AND item_id = ?;`;
      this._database.prepare(updateQuery).run(command.queryTime, valueStr, command.trackedInstant, command.groupId, command.itemId);
    }
  }

  deleteItemValue(connectorId: string, groupId: string | null, itemId: string | null): void {
    const tableName = `south_item_cache_${connectorId}`;
    const query = `DELETE FROM "${tableName}" WHERE group_id = ? AND item_id = ?;`;
    try {
      this._database.prepare(query).run(itemId);
    } catch {
      // Ignore if table/item fails
    }
  }

  private toSouthItemLastValue(result: Record<string, string>): Omit<SouthItemLastValue, 'itemName' | 'groupName'> {
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
      groupId: result.group_id || null,
      queryTime: result.query_time || null,
      value: parsedValue,
      trackedInstant: result.tracked_instant || null
    };
  }
}
