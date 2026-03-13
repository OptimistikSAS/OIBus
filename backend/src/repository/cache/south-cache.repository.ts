import { Database } from 'better-sqlite3';
import { SouthCache } from '../../../shared/model/south-connector.model';
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

  getSouthCache(tableName: string, scanModeId: string, itemId: string): SouthCache | null {
    const query = `SELECT south_id, scan_mode_id, item_id, max_instant FROM "${tableName}" WHERE scan_mode_id = ? AND item_id = ?;`;
    const result = this._database.prepare(query).get(scanModeId, itemId);
    if (!result) return null;
    return this.toSouthCache(result as Record<string, string>);
  }

  save(tableName: string, command: SouthCache): void {
    const foundScanMode = this.getSouthCache(tableName, command.scanModeId, command.itemId);
    if (!foundScanMode) {
      const insertQuery = `INSERT INTO "${tableName}" (south_id, scan_mode_id, item_id, max_instant) VALUES (?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(command.southId, command.scanModeId, command.itemId, command.maxInstant);
    } else {
      const query = `UPDATE "${tableName}" SET max_instant = ? WHERE scan_mode_id = ? AND item_id = ?;`;
      this._database.prepare(query).run(command.maxInstant, command.scanModeId, command.itemId);
    }
  }

  /**
   * Retrieve a map of unique scan modes with their latest max instant
   *
   * NOTE: Map elements are sorted by max instant from latest to oldest
   */
  getLatestMaxInstants(tableName: string): Map<string, Instant> | null {
    const query = `SELECT max(max_instant) as maxInstant, scan_mode_id AS scanModeId FROM "${tableName}" GROUP BY scan_mode_id ORDER BY max_instant DESC;`;
    const results = this._database.prepare(query).all() as Array<{ maxInstant: Instant; scanModeId: string }>;
    if (results.length === 0) return null;
    return new Map(results.map(r => [r.scanModeId, r.maxInstant]));
  }

  delete(tableName: string, scanModeId: string, itemId: string): void {
    const query = `DELETE FROM "${tableName}" WHERE scan_mode_id = ? AND item_id = ?;`;
    this._database.prepare(query).run(scanModeId, itemId);
  }

  deleteAllBySouthConnector(tableName: string): void {
    const query = `DELETE FROM "${tableName}";`;
    this._database.prepare(query).run();
  }

  deleteAllBySouthItem(tableName: string, itemId: string): void {
    const query = `DELETE FROM "${tableName}" WHERE item_id = ?;`;
    this._database.prepare(query).run(itemId);
  }

  deleteAllByScanMode(tableName: string, scanModeId: string): void {
    const query = `DELETE FROM "${tableName}" WHERE scan_mode_id = ?;`;
    this._database.prepare(query).run(scanModeId);
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

  private toSouthCache(result: Record<string, string>): SouthCache {
    return {
      southId: result.south_id,
      scanModeId: result.scan_mode_id,
      itemId: result.item_id,
      maxInstant: result.max_instant
    };
  }
}
