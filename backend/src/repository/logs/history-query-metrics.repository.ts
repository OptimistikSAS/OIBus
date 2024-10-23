import { Database } from 'better-sqlite3';
import { HistoryQueryMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

const HISTORY_QUERY_METRICS_TABLE = 'history_query_metrics';

/**
 * Repository used for History Query Metrics
 */
export default class HistoryQueryMetricsRepository {
  constructor(private readonly _database: Database) {}

  initMetrics(historyQueryId: string) {
    const foundMetrics = this.getMetrics(historyQueryId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${HISTORY_QUERY_METRICS_TABLE} (history_query_id, metrics_start, nb_values_retrieved, nb_files_retrieved, ` +
        `last_value_retrieved, last_file_retrieved, last_south_connection, last_south_run_start, last_south_run_duration, ` +
        `nb_values_sent, nb_files_sent, last_value_sent, last_file_sent, last_north_connection, last_north_run_start, ` +
        `last_north_run_duration, north_cache_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database
        .prepare(insertQuery)
        .run(historyQueryId, DateTime.now().toUTC().toISO(), 0, 0, null, null, null, null, null, 0, 0, null, null, null, null, null, 0);
    }
  }

  getMetrics(historyQueryId: string): HistoryQueryMetrics | null {
    const query =
      `SELECT metrics_start, nb_values_retrieved, nb_files_retrieved, ` +
      `last_value_retrieved, last_file_retrieved, last_south_connection, last_south_run_start, last_south_run_duration, ` +
      `nb_values_sent, nb_files_sent, last_value_sent, last_file_sent, last_north_connection, last_north_run_start, ` +
      `last_north_run_duration, north_cache_size FROM ${HISTORY_QUERY_METRICS_TABLE} WHERE history_query_id = ?;`;
    const result = this._database.prepare(query).get(historyQueryId);
    if (!result) return null;
    return this.toHistoryQueryMetrics(result as Record<string, string | number>);
  }

  updateMetrics(historyQueryId: string, metrics: HistoryQueryMetrics): void {
    const updateQuery =
      `UPDATE ${HISTORY_QUERY_METRICS_TABLE} SET metrics_start = ?, nb_values_retrieved = ?, nb_files_retrieved = ?, ` +
      `last_value_retrieved = ?, last_file_retrieved = ?, last_south_connection = ?, last_south_run_start = ?, last_south_run_duration = ?, ` +
      `nb_values_sent = ?, nb_files_sent = ?, last_value_sent = ?, last_file_sent = ?, last_north_connection = ?, last_north_run_start = ?, ` +
      `last_north_run_duration = ?, north_cache_size = ? WHERE history_query_id = ?;`;
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.south.numberOfValuesRetrieved,
        metrics.south.numberOfFilesRetrieved,
        metrics.south.lastValueRetrieved ? JSON.stringify(metrics.south.lastValueRetrieved) : null,
        metrics.south.lastFileRetrieved,
        metrics.south.lastConnection,
        metrics.south.lastRunStart,
        metrics.south.lastRunDuration,
        metrics.north.numberOfValuesSent,
        metrics.north.numberOfFilesSent,
        metrics.north.lastValueSent ? JSON.stringify(metrics.north.lastValueSent) : null,
        metrics.north.lastFileSent,
        metrics.north.lastConnection,
        metrics.north.lastRunStart,
        metrics.north.lastRunDuration,
        metrics.north.cacheSize,
        historyQueryId
      );
  }

  removeMetrics(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_QUERY_METRICS_TABLE} WHERE history_query_id = ?;`;
    this._database.prepare(query).run(historyQueryId);
  }

  private toHistoryQueryMetrics(result: Record<string, string | number>): HistoryQueryMetrics {
    return {
      metricsStart: result.metrics_start as Instant,
      north: {
        lastConnection: result.last_north_connection as Instant,
        lastRunStart: result.last_north_run_start as Instant,
        lastRunDuration: result.last_north_run_duration as number,
        numberOfValuesSent: result.nb_values_sent as number,
        numberOfFilesSent: result.nb_files_sent as number,
        lastValueSent: result.last_value_sent ? JSON.parse(result.last_value_sent as string) : null,
        lastFileSent: result.last_file_sent as string,
        cacheSize: result.north_cache_size as number
      },
      south: {
        lastConnection: result.last_south_connection as Instant,
        lastRunStart: result.last_south_run_start as Instant,
        lastRunDuration: result.last_south_run_duration as number,
        numberOfValuesRetrieved: result.nb_values_retrieved as number,
        numberOfFilesRetrieved: result.nb_files_retrieved as number,
        lastValueRetrieved: result.last_value_retrieved ? JSON.parse(result.last_value_retrieved as string) : null,
        lastFileRetrieved: result.last_file_retrieved as string
      },
      historyMetrics: {
        running: false,
        intervalProgress: 0,
        currentIntervalStart: null,
        currentIntervalEnd: null,
        currentIntervalNumber: 0,
        numberOfIntervals: 0
      }
    };
  }
}
