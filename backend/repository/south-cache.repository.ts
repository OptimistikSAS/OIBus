import { Database } from 'better-sqlite3';
import { SouthCache } from '../../shared/model/south-connector.model';

export const SOUTH_CACHE_TABLE = 'cache_history';

/**
 * Repository used for South connectors (Data sources)
 */
export default class SouthCacheRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
  }

  createCacheHistoryTable() {
    const query = `CREATE TABLE IF NOT EXISTS ${SOUTH_CACHE_TABLE} (scan_mode_id TEXT PRIMARY KEY, interval_index INTEGER, max_instant TEXT);`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve a South connector cache scan mode
   */
  getSouthCacheScanMode(id: string): SouthCache | null {
    const query = `SELECT scan_mode_id as scanModeId, interval_index as intervalIndex, max_instant as maxInstant FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return {
      scanModeId: result.scanModeId,
      intervalIndex: result.intervalIndex,
      maxInstant: result.maxInstant
    };
  }

  /**
   * Create or update a South connector cache scan mode with the scan mode ID as primary key
   */
  createOrUpdateCacheScanMode(command: SouthCache): void {
    const foundScanMode = this.getSouthCacheScanMode(command.scanModeId);
    if (!foundScanMode) {
      const insertQuery = `INSERT INTO ${SOUTH_CACHE_TABLE} (scan_mode_id, interval_index, max_instant) VALUES (?, ?, ?);`;
      this.database.prepare(insertQuery).run(command.scanModeId, command.intervalIndex, command.maxInstant);
    } else {
      const query = `UPDATE ${SOUTH_CACHE_TABLE} SET interval_index = ?, max_instant = ? WHERE scan_mode_id = ?;`;
      this.database.prepare(query).run(command.intervalIndex, command.maxInstant, command.scanModeId);
    }
  }

  /**
   * Delete a South connector cache scan mode by its scan mode ID
   */
  deleteCacheScanMode(id: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`;
    this.database.prepare(query).run(id);
  }
}
