import { Database, Statement } from 'better-sqlite3';
import { SouthItemLastValue } from '../../../shared/model/south-connector.model';

/**
 * Repository used for South connector cache (Scan mode instant storage)
 *
 * Each South connector now has its own cache table (south_item_cache_{southId})
 * instead of using a single global cache_history table.
 *
 * Prepared statements are cached per connector to skip the prepare() roundtrip
 * on every call (caches are invalidated when the connector's table is created
 * or dropped, since the statement is bound to a specific table name).
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  // One entry per (connectorId, statement-kind). Built lazily on first use so a
  // repository that only ever sees `getItemLastValue` doesn't pay to prepare an
  // UPSERT it'll never run.
  private readonly getStmtCache = new Map<string, Statement>();
  private readonly upsertStmtCache = new Map<string, Statement>();
  private readonly deleteStmtCache = new Map<string, Statement>();

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
    // Defensive: a previous statement-cache entry for this connector would
    // reference the old table identity. Drop it so the next call rebuilds.
    this.invalidateStatementCache(connectorId);
  }

  /**
   * Drop the item value table for a connector
   */
  dropItemValueTable(connectorId: string): void {
    const tableName = `south_item_cache_${connectorId}`;
    this._database.prepare(`DROP TABLE IF EXISTS "${tableName}";`).run();
    this.invalidateStatementCache(connectorId);
  }

  /**
   * Get last value for an item
   */
  getItemLastValue(connectorId: string, itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null {
    try {
      const stmt = this.cachedStatement(
        this.getStmtCache,
        connectorId,
        table => `SELECT group_id, item_id, query_time, value, tracked_instant FROM "${table}" WHERE item_id = ?;`
      );
      const result = stmt.get(itemId) as Record<string, string> | undefined;
      if (!result) return null;
      return this.toSouthItemLastValue(result);
    } catch {
      // Table might not exist if cache never initialized or deleted. Drop the
      // cached statement too — it references a now-invalid table identity.
      this.getStmtCache.delete(connectorId);
      return null;
    }
  }

  /**
   * Save or update the last item value
   */
  saveItemLastValue(connectorId: string, command: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    const stmt = this.cachedStatement(
      this.upsertStmtCache,
      connectorId,
      table => `INSERT OR REPLACE INTO "${table}" (group_id, item_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?);`
    );
    stmt.run(command.groupId, command.itemId, command.queryTime, valueStr, command.trackedInstant);
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    try {
      const stmt = this.cachedStatement(this.deleteStmtCache, connectorId, table => `DELETE FROM "${table}" WHERE item_id = ?;`);
      stmt.run(itemId);
    } catch {
      // Ignore if table/item fails — drop the cached statement so the next
      // call doesn't keep failing against a stale table reference.
      this.deleteStmtCache.delete(connectorId);
    }
  }

  /**
   * Memoise a prepared Statement per (cache, connectorId). The `buildSql`
   * callback receives the fully-qualified table name so each caller stays
   * focused on its own SQL shape.
   */
  private cachedStatement(cache: Map<string, Statement>, connectorId: string, buildSql: (table: string) => string): Statement {
    let stmt = cache.get(connectorId);
    if (!stmt) {
      stmt = this._database.prepare(buildSql(`south_item_cache_${connectorId}`));
      cache.set(connectorId, stmt);
    }
    return stmt;
  }

  private invalidateStatementCache(connectorId: string): void {
    this.getStmtCache.delete(connectorId);
    this.upsertStmtCache.delete(connectorId);
    this.deleteStmtCache.delete(connectorId);
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
