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
        `content_sent_size, content_cached_size, content_errored_size, content_archived_size, last_content_sent, last_north_connection, last_north_run_start, ` +
        `last_north_run_duration, north_current_cache_size, north_current_error_size, north_current_archive_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database
        .prepare(insertQuery)
        .run(
          historyQueryId,
          DateTime.now().toUTC().toISO(),
          0,
          0,
          null,
          null,
          null,
          null,
          null,
          0,
          0,
          0,
          0,
          null,
          null,
          null,
          null,
          0,
          0,
          0
        );
    }
  }

  getMetrics(historyQueryId: string): HistoryQueryMetrics | null {
    const query =
      `SELECT metrics_start, nb_values_retrieved, nb_files_retrieved, ` +
      `last_value_retrieved, last_file_retrieved, last_south_connection, last_south_run_start, last_south_run_duration, ` +
      `content_sent_size, content_cached_size, content_errored_size, content_archived_size, last_content_sent, last_north_connection, last_north_run_start, ` +
      `last_north_run_duration, north_current_cache_size, north_current_error_size, north_current_archive_size FROM ${HISTORY_QUERY_METRICS_TABLE} WHERE history_query_id = ?;`;
    const result = this._database.prepare(query).get(historyQueryId);
    if (!result) return null;
    return this.toHistoryQueryMetrics(result as Record<string, string | number>);
  }

  updateMetrics(historyQueryId: string, metrics: HistoryQueryMetrics): void {
    const updateQuery =
      `UPDATE ${HISTORY_QUERY_METRICS_TABLE} SET metrics_start = ?, nb_values_retrieved = ?, nb_files_retrieved = ?, ` +
      `last_value_retrieved = ?, last_file_retrieved = ?, last_south_connection = ?, last_south_run_start = ?, last_south_run_duration = ?, ` +
      `content_sent_size = ?, content_cached_size = ?, content_errored_size = ?, content_archived_size = ?, last_content_sent = ?, last_north_connection = ?, last_north_run_start = ?, ` +
      `last_north_run_duration = ?, north_current_cache_size = ?, north_current_error_size = ?, north_current_archive_size = ? WHERE history_query_id = ?;`;
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
        metrics.north.contentSentSize,
        metrics.north.contentErroredSize,
        metrics.north.contentArchivedSize,
        metrics.north.contentCachedSize,
        metrics.north.lastContentSent,
        metrics.north.lastConnection,
        metrics.north.lastRunStart,
        metrics.north.lastRunDuration,
        metrics.north.currentCacheSize,
        metrics.north.currentErrorSize,
        metrics.north.currentArchiveSize,
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
        contentSentSize: result.content_sent_size as number,
        contentCachedSize: result.content_cached_size as number,
        contentErroredSize: result.content_errored_size as number,
        contentArchivedSize: result.content_archived_size as number,
        lastContentSent: result.last_content_sent as string | null,
        currentCacheSize: result.north_current_cache_size as number,
        currentErrorSize: result.north_current_error_size as number,
        currentArchiveSize: result.north_current_archive_size as number
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
