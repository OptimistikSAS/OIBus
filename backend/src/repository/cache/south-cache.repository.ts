import { Database, Statement } from 'better-sqlite3';
import { SouthItemLastValue } from '../../../shared/model/south-connector.model';

/**
 * Internal cache-row shape. Distinct from the public {@link SouthItemLastValue} API type (whose
 * `itemId` is always the requested item's id, filled in by the caller) because a row for a synced
 * group on a batching connector is keyed by `groupId` alone — `itemId` is `null` for that row,
 * there being no single item it belongs to.
 */
export type SouthCacheEntry = Omit<SouthItemLastValue, 'itemName' | 'groupName' | 'itemId'> & { itemId: string | null };

/**
 * Repository for South connector cache (per-item / per-group history tracking).
 *
 * All connectors share a single `south_item_cache` table (PRIMARY KEY: south_id, item_id).
 * A row either tracks one item (`item_id` set, `group_id` null or set to the item's own group when
 * the item isn't synced with it) or tracks a synced group shared by a batching connector
 * (`group_id` set, `item_id` NULL — see `saveGroupLastValue`). Prepared statements are created once
 * at construction time since the table name is fixed.
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  private readonly getStmt: Statement;
  private readonly getByGroupStmt: Statement;
  private readonly upsertStmt: Statement;
  private readonly updateGroupStmt: Statement;
  private readonly insertGroupStmt: Statement;
  private readonly deleteStmt: Statement;
  private readonly deleteAllBySouthStmt: Statement;

  constructor(database: Database) {
    this._database = database;
    this.getStmt = this._database.prepare(
      'SELECT south_id, group_id, item_id, query_time, value, tracked_instant ' +
        'FROM south_item_cache WHERE south_id = ? AND item_id = ?;'
    );
    this.getByGroupStmt = this._database.prepare(
      'SELECT south_id, group_id, item_id, query_time, value, tracked_instant ' +
        'FROM south_item_cache WHERE south_id = ? AND group_id = ? LIMIT 1;'
    );
    this.upsertStmt = this._database.prepare(
      'INSERT OR REPLACE INTO south_item_cache (south_id, group_id, item_id, query_time, value, tracked_instant) ' +
        'VALUES (?, ?, ?, ?, ?, ?);'
    );
    // Group-shared rows have item_id = NULL, so they can't rely on the (south_id, item_id) PRIMARY
    // KEY for INSERT OR REPLACE to upsert correctly: SQLite treats every NULL as distinct from every
    // other NULL for uniqueness purposes, so two saves with item_id = NULL would never be seen as
    // conflicting and would just keep appending rows instead of replacing. Update-if-exists,
    // else-insert (keyed on group_id explicitly) sidesteps that entirely.
    this.updateGroupStmt = this._database.prepare(
      'UPDATE south_item_cache SET query_time = ?, value = ?, tracked_instant = ? ' +
        'WHERE south_id = ? AND group_id = ? AND item_id IS NULL;'
    );
    this.insertGroupStmt = this._database.prepare(
      'INSERT INTO south_item_cache (south_id, item_id, group_id, query_time, value, tracked_instant) ' + 'VALUES (?, NULL, ?, ?, ?, ?);'
    );
    this.deleteStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ? AND item_id = ?;');
    this.deleteAllBySouthStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ?;');
  }

  getItemLastValue(connectorId: string, itemId: string): SouthCacheEntry | null {
    const result = this.getStmt.get(connectorId, itemId) as Record<string, string> | undefined;
    if (!result) return null;
    return this.toSouthCacheEntry(result);
  }

  getGroupLastValue(connectorId: string, groupId: string): SouthCacheEntry | null {
    const result = this.getByGroupStmt.get(connectorId, groupId) as Record<string, string> | undefined;
    if (!result) return null;
    return this.toSouthCacheEntry(result);
  }

  /** Save a per-item cache row. `command.itemId` must be a real item id (never null). */
  saveItemLastValue(connectorId: string, command: SouthCacheEntry & { itemId: string }): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    this.upsertStmt.run(connectorId, command.groupId, command.itemId, command.queryTime, valueStr, command.trackedInstant);
  }

  /**
   * Save the single shared cache row for a synced group on a batching connector (`item_id = NULL`).
   * Explicit update-then-insert instead of `INSERT OR REPLACE` — see the constructor comment above
   * `updateGroupStmt` for why the PRIMARY KEY can't do this automatically when `item_id` is NULL.
   */
  saveGroupLastValue(connectorId: string, groupId: string, command: Omit<SouthCacheEntry, 'itemId' | 'groupId'>): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    const result = this.updateGroupStmt.run(command.queryTime, valueStr, command.trackedInstant, connectorId, groupId);
    if (result.changes === 0) {
      this.insertGroupStmt.run(connectorId, groupId, command.queryTime, valueStr, command.trackedInstant);
    }
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    this.deleteStmt.run(connectorId, itemId);
  }

  deleteItemsBySouth(connectorId: string): void {
    this.deleteAllBySouthStmt.run(connectorId);
  }

  private toSouthCacheEntry(result: Record<string, string>): SouthCacheEntry {
    let parsedValue: unknown = null;
    if (result.value) {
      try {
        parsedValue = JSON.parse(result.value);
      } catch {
        parsedValue = result.value;
      }
    }

    return {
      itemId: result.item_id ?? null,
      groupId: result.group_id || null,
      queryTime: result.query_time || null,
      value: parsedValue,
      trackedInstant: result.tracked_instant || null
    };
  }
}
