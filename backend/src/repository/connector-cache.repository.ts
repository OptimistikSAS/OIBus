import { Database } from 'better-sqlite3';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { ConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';

export const SOUTH_CACHE_TABLE = 'cache_history';
export const METRICS_TABLE = 'metrics';

/**
 * Repository used for South connectors (Data sources)
 */
export default class ConnectorCacheRepository {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  get database(): Database {
    return this._database;
  }

  createCacheHistoryTable() {
    const query = `CREATE TABLE IF NOT EXISTS ${SOUTH_CACHE_TABLE} (scan_mode_id TEXT PRIMARY KEY, interval_index INTEGER, max_instant TEXT);`;
    this._database.prepare(query).run();
  }

  /**
   * Retrieve a South connector cache scan mode
   */
  getSouthCacheScanMode(id: string): SouthCache | null {
    const query = `SELECT scan_mode_id as scanModeId, interval_index as intervalIndex, max_instant as maxInstant FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`;
    const result = this._database.prepare(query).get(id);
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
      this._database.prepare(insertQuery).run(command.scanModeId, command.intervalIndex, command.maxInstant);
    } else {
      const query = `UPDATE ${SOUTH_CACHE_TABLE} SET interval_index = ?, max_instant = ? WHERE scan_mode_id = ?;`;
      this._database.prepare(query).run(command.intervalIndex, command.maxInstant, command.scanModeId);
    }
  }

  /**
   * Delete a South connector cache scan mode by its scan mode ID
   */
  deleteCacheScanMode(id: string): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`;
    this._database.prepare(query).run(id);
  }

  resetDatabase(): void {
    const query = `DELETE FROM ${SOUTH_CACHE_TABLE};`;
    this._database.prepare(query).run();
  }

  createMetricsTable(connectorId: string) {
    const query =
      `CREATE TABLE IF NOT EXISTS ${METRICS_TABLE}(connector_id TEXT PRIMARY KEY,metrics_start TEXT,nb_values INTEGER, ` +
      `nb_files INTEGER, last_value TEXT, last_file TEXT, last_connection TEXT, last_run_start TEXT, last_run_duration INTEGER);`;
    this._database.prepare(query).run();

    const foundMetrics = this.getMetrics(connectorId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${METRICS_TABLE} (connector_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(connectorId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null);
    }
  }

  getMetrics(connectorId: string): ConnectorMetrics | null {
    const query =
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValues, nb_files AS numberOfFiles, ` +
      `last_value AS lastValue, last_file AS lastFile, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
      `last_run_duration AS lastRunDuration FROM ${METRICS_TABLE} WHERE connector_id = ?;`;
    const result = this._database.prepare(query).get(connectorId);
    if (!result) return null;
    return {
      metricsStart: result.metricsStart,
      numberOfValues: result.numberOfValues,
      numberOfFiles: result.numberOfFiles,
      lastValue: result.lastValue ? JSON.stringify(result.lastValue) : null,
      lastFile: result.lastFile,
      lastConnection: result.lastConnection,
      lastRunStart: result.lastRunStart,
      lastRunDuration: result.lastRunDuration
    };
  }

  updateMetrics(metrics: ConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${METRICS_TABLE} SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
      `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`;
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.numberOfValues,
        metrics.numberOfFiles,
        JSON.stringify(metrics.lastValue),
        metrics.lastFile,
        metrics.lastConnection,
        metrics.lastRunStart,
        metrics.lastRunDuration
      );
  }
}
