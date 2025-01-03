import { Database } from 'better-sqlite3';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

export const SOUTH_METRICS_TABLE = 'south_metrics';

/**
 * Repository used for South connectors metrics
 */
export default class SouthConnectorMetricsRepository {
  constructor(private readonly _database: Database) {}

  initMetrics(southId: string) {
    const foundMetrics = this.getMetrics(southId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${SOUTH_METRICS_TABLE} (south_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(southId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null);
    }
  }

  getMetrics(southId: string): SouthConnectorMetrics | null {
    const query =
      `SELECT metrics_start, nb_values, nb_files, ` +
      `last_value, last_file, last_connection, last_run_start, ` +
      `last_run_duration FROM ${SOUTH_METRICS_TABLE} WHERE south_id = ?;`;
    const result = this._database.prepare(query).get(southId);
    if (!result) return null;
    return this.toSouthConnectorMetrics(result as Record<string, string | number>);
  }

  updateMetrics(southId: string, metrics: SouthConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${SOUTH_METRICS_TABLE} SET metrics_start = ?, nb_values = ?, nb_files = ?, last_value = ?, ` +
      `last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ? WHERE south_id = ?;`;
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
        metrics.lastRunDuration,
        southId
      );
  }

  removeMetrics(southId: string): void {
    const query = `DELETE FROM ${SOUTH_METRICS_TABLE} WHERE south_id = ?;`;
    this._database.prepare(query).run(southId);
  }

  private toSouthConnectorMetrics(result: Record<string, string | number>): SouthConnectorMetrics {
    return {
      metricsStart: result.metrics_start as Instant,
      numberOfValuesRetrieved: result.nb_values as number,
      numberOfFilesRetrieved: result.nb_files as number,
      lastValueRetrieved: result.last_value ? JSON.parse(result.last_value as string) : null,
      lastFileRetrieved: result.last_file as string | null,
      lastConnection: result.last_connection as Instant | null,
      lastRunStart: result.last_run_start as Instant | null,
      lastRunDuration: result.last_run_duration as number
    };
  }
}
