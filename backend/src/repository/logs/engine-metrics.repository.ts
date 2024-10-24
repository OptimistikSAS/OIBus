import { Database } from 'better-sqlite3';
import { EngineMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

export const ENGINE_METRICS_TABLE = 'engine_metrics';

/**
 * Repository used for Engine metrics
 */
export default class EngineMetricsRepository {
  constructor(private readonly _database: Database) {}

  initMetrics(engineId: string) {
    const foundMetrics = this.getMetrics(engineId);
    if (!foundMetrics) {
      const insertQuery =
        `INSERT INTO ${ENGINE_METRICS_TABLE} (engine_id, metrics_start, process_cpu_usage_instant, process_cpu_usage_average, process_uptime, free_memory, ` +
        'total_memory, min_rss, current_rss, max_rss, min_heap_total, current_heap_total, ' +
        'max_heap_total, min_heap_used, current_heap_used, max_heap_used, min_external, current_external, ' +
        'max_external, min_array_buffers, current_array_buffers, max_array_buffers) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
      this._database
        .prepare(insertQuery)
        .run(engineId, DateTime.now().toUTC().toISO()!, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  }

  getMetrics(engineId: string): EngineMetrics | null {
    const query =
      'SELECT metrics_start, process_cpu_usage_instant, process_cpu_usage_average, process_uptime, ' +
      'free_memory, total_memory, min_rss, current_rss, max_rss, min_heap_total, current_heap_total, ' +
      'max_heap_total, min_heap_used, current_heap_used, max_heap_used, min_external, current_external, ' +
      `max_external, min_array_buffers, current_array_buffers, max_array_buffers FROM ${ENGINE_METRICS_TABLE} WHERE engine_id = ?;`;
    const result = this._database.prepare(query).get(engineId);
    if (!result) return null;
    return this.toEngineMetrics(result as Record<string, string | number>);
  }

  updateMetrics(engineId: string, metrics: EngineMetrics): void {
    const updateQuery =
      `UPDATE ${ENGINE_METRICS_TABLE} SET metrics_start = ?, process_cpu_usage_instant = ?, process_cpu_usage_average = ?, process_uptime = ?, free_memory = ?, ` +
      'total_memory = ?, min_rss = ?, current_rss = ?, max_rss = ?, min_heap_total = ?, current_heap_total = ?, ' +
      'max_heap_total = ?, min_heap_used = ?, current_heap_used = ?, max_heap_used = ?, min_external = ?, current_external = ?, ' +
      'max_external = ?, min_array_buffers = ?, current_array_buffers = ?, max_array_buffers = ? WHERE engine_id = ?;';
    this._database
      .prepare(updateQuery)
      .run(
        metrics.metricsStart,
        metrics.processCpuUsageInstant,
        metrics.processCpuUsageAverage,
        metrics.processUptime,
        metrics.freeMemory,
        metrics.totalMemory,
        metrics.minRss,
        metrics.currentRss,
        metrics.maxRss,
        metrics.minHeapTotal,
        metrics.currentHeapTotal,
        metrics.maxHeapTotal,
        metrics.minHeapUsed,
        metrics.currentHeapUsed,
        metrics.maxHeapUsed,
        metrics.minExternal,
        metrics.currentExternal,
        metrics.maxExternal,
        metrics.minArrayBuffers,
        metrics.currentArrayBuffers,
        metrics.maxArrayBuffers,
        engineId
      );
  }

  removeMetrics(engineId: string): void {
    const query = `DELETE FROM ${ENGINE_METRICS_TABLE} WHERE engine_id = ?;`;
    this._database.prepare(query).run(engineId);
  }

  private toEngineMetrics(result: Record<string, string | number>): EngineMetrics {
    return {
      metricsStart: result.metrics_start as Instant,
      processCpuUsageInstant: result.process_cpu_usage_instant as number,
      processCpuUsageAverage: result.process_cpu_usage_average as number,
      processUptime: result.process_uptime as number,
      freeMemory: result.free_memory as number,
      totalMemory: result.total_memory as number,
      minRss: result.min_rss as number,
      currentRss: result.current_rss as number,
      maxRss: result.max_rss as number,
      minHeapTotal: result.min_heap_total as number,
      currentHeapTotal: result.current_heap_total as number,
      maxHeapTotal: result.max_heap_total as number,
      minHeapUsed: result.min_heap_used as number,
      currentHeapUsed: result.current_heap_used as number,
      maxHeapUsed: result.max_heap_used as number,
      minExternal: result.min_external as number,
      currentExternal: result.current_external as number,
      maxExternal: result.max_external as number,
      minArrayBuffers: result.min_array_buffers as number,
      currentArrayBuffers: result.current_array_buffers as number,
      maxArrayBuffers: result.max_array_buffers as number
    };
  }
}
