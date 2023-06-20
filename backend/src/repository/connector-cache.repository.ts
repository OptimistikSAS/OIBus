import { Database } from 'better-sqlite3';
import { SouthCache } from '../../../shared/model/south-connector.model';

export const SOUTH_CACHE_TABLE = 'cache_history';

/**
 * Repository used for South connector cache (Scan mode instant storage)
 */
export default class ConnectorCacheRepository {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  get database(): Database {
    return this._database;
  }
  createSouthCacheScanModeTable() {
    const query = `CREATE TABLE IF NOT EXISTS ${SOUTH_CACHE_TABLE} (scan_mode_id TEXT, item_id TEXT, interval_index INTEGER, max_instant TEXT, PRIMARY KEY(scan_mode_id, item_id));`;
    this._database.prepare(query).run();
  }

  /**
   * Retrieve a South connector cache scan mode
   */
  getSouthCacheScanMode(scanModeId: string, itemId: string): SouthCache | null {
    const query = `SELECT scan_mode_id AS scanModeId, item_id AS itemId, interval_index AS intervalIndex, max_instant AS maxInstant FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ? AND item_id = ?;`;
    const result: SouthCache | undefined = this._database.prepare(query).get(scanModeId, itemId) as SouthCache;
    if (!result) return null;
    return {
      scanModeId: result.scanModeId,
      itemId: result.itemId,
      intervalIndex: result.intervalIndex,
      maxInstant: result.maxInstant
    };
  }

  /**
   * Create or update a South connector cache scan mode with the scan mode ID as primary key
   */
  createOrUpdateCacheScanMode(command: SouthCache): void {
    const foundScanMode = this.getSouthCacheScanMode(command.scanModeId, command.itemId);
    if (!foundScanMode) {
      const insertQuery = `INSERT INTO ${SOUTH_CACHE_TABLE} (scan_mode_id, item_id, interval_index, max_instant) VALUES (?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(command.scanModeId, command.itemId, command.intervalIndex, command.maxInstant);
    } else {
      const query = `UPDATE ${SOUTH_CACHE_TABLE} SET interval_index = ?, max_instant = ? WHERE scan_mode_id = ? AND item_id = ?;`;
      this._database.prepare(query).run(command.intervalIndex, command.maxInstant, command.scanModeId, command.itemId);
    }
  }

  /**
   * Delete a South connector cache scan mode by its scan mode ID
   */
  deleteCacheScanMode(scanModeId: string, itemId: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ? AND item_id = ?;`;
    this._database.prepare(query).run(scanModeId, itemId);
  }

  resetSouthCacheDatabase(): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE};`;
    this._database.prepare(query).run();
  }
}
