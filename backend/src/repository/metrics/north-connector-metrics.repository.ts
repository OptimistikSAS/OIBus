import { Database } from 'better-sqlite3';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

export const NORTH_METRICS_TABLE = 'north_metrics';

/**
 * The persisted subset of north metrics. The current cache/error/archive size gauges are NOT
 * persisted — they are read live from the cache service at serialization time — so the repository
 * neither stores nor returns them. The owning service composes the full {@link NorthConnectorMetrics}.
 */
export type PersistedNorthConnectorMetrics = Omit<NorthConnectorMetrics, 'currentCacheSize' | 'currentErrorSize' | 'currentArchiveSize'>;

/**
 * Repository used for North connectors metrics
 */
export default class NorthConnectorMetricsRepository {
  constructor(private readonly _database: Database) {}

  initMetrics(northId: string) {
    const foundMetrics = this.getMetrics(northId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${NORTH_METRICS_TABLE} (north_id, metrics_start, content_sent_size, content_cached_size, content_errored_size, content_archived_size, last_content_sent, ` +
        `last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
      this._database.prepare(insertQuery).run(northId, DateTime.now().toUTC().toISO(), 0, 0, 0, 0, null, null, null, null);
    }
  }

  getMetrics(northId: string): PersistedNorthConnectorMetrics | null {
    const query =
      `SELECT metrics_start, content_sent_size, content_cached_size, content_errored_size, content_archived_size, last_content_sent, last_connection, last_run_start, ` +
      `last_run_duration FROM ${NORTH_METRICS_TABLE} WHERE north_id = ?;`;
    const result = this._database.prepare(query).get(northId);
    if (!result) return null;
    return this.toNorthConnectorMetrics(result as Record<string, string | number>);
  }

  updateMetrics(northId: string, metrics: PersistedNorthConnectorMetrics): void {
    const updateQuery =
      `UPDATE ${NORTH_METRICS_TABLE} SET metrics_start = ?, content_sent_size = ?, content_cached_size = ?, content_errored_size = ?, content_archived_size = ?, last_content_sent = ?, ` +
      'last_connection = ?, last_run_start = ?, last_run_duration = ? WHERE north_id = ?;';
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.contentSentSize,
        metrics.contentCachedSize,
        metrics.contentErroredSize,
        metrics.contentArchivedSize,
        typeof metrics.lastContentSent === 'string' || metrics.lastContentSent === null
          ? metrics.lastContentSent
          : JSON.stringify(metrics.lastContentSent),
        metrics.lastConnection,
        metrics.lastRunStart,
        metrics.lastRunDuration,
        northId
      );
  }

  removeMetrics(northId: string): void {
    const query = `DELETE FROM ${NORTH_METRICS_TABLE} WHERE north_id = ?;`;
    this._database.prepare(query).run(northId);
  }

  private toNorthConnectorMetrics(result: Record<string, string | number>): PersistedNorthConnectorMetrics {
    return {
      metricsStart: result.metrics_start as Instant,
      contentSentSize: result.content_sent_size as number,
      contentCachedSize: result.content_cached_size as number,
      contentErroredSize: result.content_errored_size as number,
      contentArchivedSize: result.content_archived_size as number,
      lastContentSent: result.last_content_sent as string | null,
      lastConnection: result.last_connection as Instant | null,
      lastRunStart: result.last_run_start as Instant | null,
      lastRunDuration: result.last_run_duration as number
    };
  }
}
