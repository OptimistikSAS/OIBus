import { Database } from 'better-sqlite3';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';

export const SOUTH_METRICS_TABLE = 'south_metrics';

/**
 * Repository used for South connectors metrics
 */
export default class SouthConnectorMetricsRepository {
  constructor(private readonly _database: Database) {}

  get database(): Database {
    return this._database;
  }

  createMetricsTable(connectorId: string) {
    const foundMetrics = this.getMetrics(connectorId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${SOUTH_METRICS_TABLE} (south_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(connectorId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null);
    }
  }

  getMetrics(connectorId: string): SouthConnectorMetrics | null {
    const query =
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValuesRetrieved, nb_files AS numberOfFilesRetrieved, ` +
      `last_value AS lastValueRetrieved, last_file AS lastFileRetrieved, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
      `last_run_duration AS lastRunDuration FROM ${SOUTH_METRICS_TABLE} WHERE south_id = ?;`;
    const result: SouthConnectorMetrics | undefined = this._database.prepare(query).get(connectorId) as SouthConnectorMetrics;
    if (!result) return null;
    return {
      metricsStart: result.metricsStart,
      numberOfValuesRetrieved: result.numberOfValuesRetrieved,
      numberOfFilesRetrieved: result.numberOfFilesRetrieved,
      lastValueRetrieved: result.lastValueRetrieved ? JSON.parse(result.lastValueRetrieved) : null,
      lastFileRetrieved: result.lastFileRetrieved,
      lastConnection: result.lastConnection,
      lastRunStart: result.lastRunStart,
      lastRunDuration: result.lastRunDuration,
      historyMetrics: {}
    };
  }

  updateMetrics(metrics: SouthConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${SOUTH_METRICS_TABLE} SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
      `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`;
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.numberOfValuesRetrieved,
        metrics.numberOfFilesRetrieved,
        metrics.lastValueRetrieved ? JSON.stringify(metrics.lastValueRetrieved) : null,
        metrics.lastFileRetrieved,
        metrics.lastConnection,
        metrics.lastRunStart,
        metrics.lastRunDuration
      );
  }

  removeMetrics(connectorId: string): void {
    const query = `DELETE FROM ${SOUTH_METRICS_TABLE} WHERE south_id = ?;`;
    this._database.prepare(query).run(connectorId);
  }
}
