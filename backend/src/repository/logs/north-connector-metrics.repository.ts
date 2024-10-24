import { Database } from 'better-sqlite3';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

export const NORTH_METRICS_TABLE = 'north_metrics';

/**
 * Repository used for North connectors metrics
 */
export default class NorthConnectorMetricsRepository {
  constructor(private readonly _database: Database) {}

  initMetrics(northId: string) {
    const foundMetrics = this.getMetrics(northId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${NORTH_METRICS_TABLE} (north_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration, cache_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(northId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null, 0);
    }
  }

  getMetrics(northId: string): NorthConnectorMetrics | null {
    const query =
      `SELECT metrics_start, nb_values, nb_files, last_value, last_file, last_connection, last_run_start, ` +
      `last_run_duration, cache_size FROM ${NORTH_METRICS_TABLE} WHERE north_id = ?;`;
    const result = this._database.prepare(query).get(northId);
    if (!result) return null;
    return this.toNorthConnectorMetrics(result as Record<string, string | number>);
  }

  updateMetrics(northId: string, metrics: NorthConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${NORTH_METRICS_TABLE} SET metrics_start = ?, nb_values = ?, nb_files = ?, last_value = ?, last_file = ?, ` +
      'last_connection = ?, last_run_start = ?, last_run_duration = ?, cache_size = ? WHERE north_id = ?;';
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
        metrics.lastRunDuration,
        metrics.cacheSize,
        northId
      );
  }

  removeMetrics(northId: string): void {
    const query = `DELETE FROM ${NORTH_METRICS_TABLE} WHERE north_id = ?;`;
    this._database.prepare(query).run(northId);
  }

  private toNorthConnectorMetrics(result: Record<string, string | number>): NorthConnectorMetrics {
    return {
      metricsStart: result.metrics_start as Instant,
      numberOfValuesSent: result.nb_values as number,
      numberOfFilesSent: result.nb_files as number,
      lastValueSent: result.last_value ? JSON.parse(result.last_value as string) : null,
      lastFileSent: result.last_file as string | null,
      lastConnection: result.last_connection as Instant | null,
      lastRunStart: result.last_run_start as Instant | null,
      lastRunDuration: result.last_run_duration as number,
      cacheSize: result.cache_size as number
    };
  }
}
