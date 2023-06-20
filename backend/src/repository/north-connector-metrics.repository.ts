import { Database } from 'better-sqlite3';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';

export const CONNECTOR_METRICS_TABLE = 'north_metrics';

/**
 * Repository used for North connectors metrics
 */
export default class NorthConnectorMetricsRepository {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  get database(): Database {
    return this._database;
  }

  createMetricsTable(connectorId: string) {
    const query =
      `CREATE TABLE IF NOT EXISTS ${CONNECTOR_METRICS_TABLE}(connector_id TEXT PRIMARY KEY, metrics_start TEXT, nb_values INTEGER, ` +
      `nb_files INTEGER, last_value TEXT, last_file TEXT, last_connection TEXT, last_run_start TEXT, last_run_duration INTEGER);`;
    this._database.prepare(query).run();

    const foundMetrics = this.getMetrics(connectorId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${CONNECTOR_METRICS_TABLE} (connector_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(connectorId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null);
    }
  }

  getMetrics(connectorId: string): NorthConnectorMetrics | null {
    const query =
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValuesSent, nb_files AS numberOfFilesSent, ` +
      `last_value AS lastValueSent, last_file AS lastFileSent, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
      `last_run_duration AS lastRunDuration FROM ${CONNECTOR_METRICS_TABLE} WHERE connector_id = ?;`;
    const result: NorthConnectorMetrics | undefined = this._database.prepare(query).get(connectorId) as NorthConnectorMetrics;
    if (!result) return null;
    return {
      metricsStart: result.metricsStart,
      numberOfValuesSent: result.numberOfValuesSent,
      numberOfFilesSent: result.numberOfFilesSent,
      lastValueSent: result.lastValueSent ? JSON.parse(result.lastValueSent) : null,
      lastFileSent: result.lastFileSent,
      lastConnection: result.lastConnection,
      lastRunStart: result.lastRunStart,
      lastRunDuration: result.lastRunDuration
    };
  }

  updateMetrics(metrics: NorthConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${CONNECTOR_METRICS_TABLE} SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
      `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`;
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.numberOfValuesSent,
        metrics.numberOfFilesSent,
        metrics.lastValueSent ? JSON.stringify(metrics.lastValueSent) : null,
        metrics.lastFileSent,
        metrics.lastConnection,
        metrics.lastRunStart,
        metrics.lastRunDuration
      );
  }

  removeMetrics(connectorId: string): void {
    const query = `DELETE FROM ${CONNECTOR_METRICS_TABLE} WHERE connector_id = ?;`;
    this._database.prepare(query).run(connectorId);
  }
}
