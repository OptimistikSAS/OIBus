import { Database } from 'better-sqlite3';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export const SOUTH_CACHE_TABLE = 'cache_history';

/**
 * Repository used for South connector cache (Scan mode instant storage)
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  getScanMode(southId: string, scanModeId: string, itemId: string): SouthCache | null {
    const query = `SELECT south_id AS southId, scan_mode_id AS scanModeId, item_id AS itemId, max_instant AS maxInstant FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;`;
    const result: SouthCache | undefined = this._database.prepare(query).get(southId, scanModeId, itemId) as SouthCache;
    if (!result) return null;
    return {
      southId: result.southId,
      scanModeId: result.scanModeId,
      itemId: result.itemId,
      maxInstant: result.maxInstant
    };
  }

  createOrUpdate(command: SouthCache): void {
    const foundScanMode = this.getScanMode(command.southId, command.scanModeId, command.itemId);
    if (!foundScanMode) {
      const insertQuery = `INSERT INTO ${SOUTH_CACHE_TABLE} (south_id, scan_mode_id, item_id, max_instant) VALUES (?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(command.southId, command.scanModeId, command.itemId, command.maxInstant);
    } else {
      const query = `UPDATE ${SOUTH_CACHE_TABLE} SET max_instant = ? WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;`;
      this._database.prepare(query).run(command.maxInstant, command.southId, command.scanModeId, command.itemId);
    }
  }

  /**
   * Retrieve a map of unique scan modes with their latest max instant
   *
   * NOTE: Map elements are sorted by max instant from latest to oldest
   */
  getLatestMaxInstants(southId: string): Map<string, Instant> | null {
    const query = `SELECT max(max_instant) as maxInstant, scan_mode_id AS scanModeId FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ? GROUP BY scan_mode_id ORDER BY max_instant DESC;`;
    const results = this._database.prepare(query).all(southId) as { maxInstant: Instant; scanModeId: string }[];
    if (results.length === 0) return null;
    return new Map(results.map(r => [r.scanModeId, r.maxInstant]));
  }

  update(southId: string, itemId: string, oldScanModeId: string, newScanModeId: string): void {
    const foundScanMode = this.getScanMode(southId, oldScanModeId, itemId);
    if (!foundScanMode) return;

    const query = `UPDATE ${SOUTH_CACHE_TABLE} SET scan_mode_id = ? WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;`;
    this._database.prepare(query).run(newScanModeId, southId, oldScanModeId, itemId);
  }

  delete(southId: string, scanModeId: string, itemId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;`;
    this._database.prepare(query).run(southId, scanModeId, itemId);
  }

  reset(southId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ?;`;
    this._database.prepare(query).run(southId);
  }

  createCustomTable(tableName: string, fields: string): void {
    this._database.prepare(`CREATE TABLE IF NOT EXISTS "${tableName}" (${fields});`).run();
  }

  runQueryOnCustomTable(query: string, params: Array<any>): any {
    this._database.prepare(query).run(...params);
  }

  getQueryOnCustomTable(query: string, params: Array<any>): any {
    return this._database.prepare(query).get(...params);
  }

  deleteAllBySouthConnector(southId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ?;`;
    this._database.prepare(query).run(southId);
  }

  deleteAllBySouthItem(itemId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE item_id = ?;`;
    this._database.prepare(query).run(itemId);
  }

  /**
   * Delete all cache scan modes of the Scan mode
   */
  deleteAllByScanMode(scanModeId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`;
    this._database.prepare(query).run(scanModeId);
  }
}
