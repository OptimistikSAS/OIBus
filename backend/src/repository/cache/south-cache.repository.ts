import { Database, Statement } from 'better-sqlite3';
import { SouthItemLastValue } from '../../../shared/model/south-connector.model';

/**
 * Repository for South connector cache (per-item history tracking).
 *
 * All connectors share a single `south_item_cache` table (PRIMARY KEY: south_id, item_id).
 * Prepared statements are created once at construction time since the table name is fixed.
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  private readonly getStmt: Statement;
  private readonly upsertStmt: Statement;
  private readonly deleteStmt: Statement;
  private readonly deleteAllBySouthStmt: Statement;

  constructor(database: Database) {
    this._database = database;
    this.getStmt = this._database.prepare(
      'SELECT south_id, group_id, item_id, query_time, value, tracked_instant ' +
        'FROM south_item_cache WHERE south_id = ? AND item_id = ?;'
    );
    this.upsertStmt = this._database.prepare(
      'INSERT OR REPLACE INTO south_item_cache (south_id, group_id, item_id, query_time, value, tracked_instant) ' +
        'VALUES (?, ?, ?, ?, ?, ?);'
    );
    this.deleteStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ? AND item_id = ?;');
    this.deleteAllBySouthStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ?;');
  }

  getItemLastValue(connectorId: string, itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null {
    const result = this.getStmt.get(connectorId, itemId) as Record<string, string> | undefined;
    if (!result) return null;
    return this.toSouthItemLastValue(result);
  }

  saveItemLastValue(connectorId: string, command: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    this.upsertStmt.run(connectorId, command.groupId, command.itemId, command.queryTime, valueStr, command.trackedInstant);
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    this.deleteStmt.run(connectorId, itemId);
  }

  deleteItemsBySouth(connectorId: string): void {
    this.deleteAllBySouthStmt.run(connectorId);
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
