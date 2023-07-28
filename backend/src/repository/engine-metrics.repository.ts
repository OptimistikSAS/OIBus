import { Database } from 'better-sqlite3';
import { EngineMetrics } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';

export const ENGINE_METRICS_TABLE = 'engine_metrics';

/**
 * Repository used for Engine metrics
 */
export default class EngineMetricsRepository {
  constructor(private readonly _database: Database) {}

  get database(): Database {
    return this._database;
  }

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
        .run(engineId, DateTime.now().toUTC().toISO(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  }

  getMetrics(engineId: string): EngineMetrics | null {
    const query =
      `SELECT metrics_start AS metricsStart, process_cpu_usage_instant AS processCpuUsageInstant, process_cpu_usage_average AS processCpuUsageAverage, process_uptime AS processUptime, ` +
      'free_memory AS freeMemory, total_memory AS totalMemory, min_rss AS minRss, current_rss AS currentRss, ' +
      'max_rss AS maxRss, min_heap_total AS minHeapTotal, current_heap_total AS currentHeapTotal, ' +
      'max_heap_total AS maxHeapTotal, min_heap_used AS minHeapUsed, current_heap_used AS currentHeapUsed, ' +
      'max_heap_used AS maxHeapUsed, min_external AS minExternal, current_external AS currentExternal, ' +
      'max_external AS maxExternal, min_array_buffers AS minArrayBuffers, current_array_buffers AS currentArrayBuffers, ' +
      `max_array_buffers AS maxArrayBuffers FROM ${ENGINE_METRICS_TABLE} WHERE engine_id = ?;`;
    const result: EngineMetrics | undefined = this._database.prepare(query).get(engineId) as EngineMetrics;
    if (!result) return null;
    return {
      metricsStart: result.metricsStart,
      processCpuUsageInstant: result.processCpuUsageInstant,
      processCpuUsageAverage: result.processCpuUsageAverage,
      processUptime: result.processUptime,
      freeMemory: result.freeMemory,
      totalMemory: result.totalMemory,
      minRss: result.minRss,
      currentRss: result.currentRss,
      maxRss: result.maxRss,
      minHeapTotal: result.minHeapTotal,
      currentHeapTotal: result.currentHeapTotal,
      maxHeapTotal: result.maxHeapTotal,
      minHeapUsed: result.minHeapUsed,
      currentHeapUsed: result.currentHeapUsed,
      maxHeapUsed: result.maxHeapUsed,
      minExternal: result.minExternal,
      currentExternal: result.currentExternal,
      maxExternal: result.maxExternal,
      minArrayBuffers: result.minArrayBuffers,
      currentArrayBuffers: result.currentArrayBuffers,
      maxArrayBuffers: result.maxArrayBuffers
    };
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
}
