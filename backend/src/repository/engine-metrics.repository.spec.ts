import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import { EngineMetrics } from '../../../shared/model/engine.model';
import EngineMetricsRepository from './engine-metrics.repository';

jest.mock('../tests/__mocks__/database.mock');
const nowDateString = '2020-02-02T02:02:02.222Z';

let database: Database;
let repository: EngineMetricsRepository;
describe('EngineMetricsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new EngineMetricsRepository(database);
  });

  it('should properly init metrics table', () => {
    repository.getMetrics = jest.fn();

    repository.initMetrics('engineId');
    expect(repository.getMetrics).toHaveBeenCalledWith('engineId');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      'INSERT INTO engine_metrics (engine_id, metrics_start, process_cpu_usage_instant, process_cpu_usage_average, process_uptime, free_memory, ' +
        'total_memory, min_rss, current_rss, max_rss, min_heap_total, current_heap_total, ' +
        'max_heap_total, min_heap_used, current_heap_used, max_heap_used, min_external, current_external, ' +
        'max_external, min_array_buffers, current_array_buffers, max_array_buffers) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith('engineId', nowDateString, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should get metrics', () => {
    const nullMetrics = repository.getMetrics('engineId');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `SELECT metrics_start AS metricsStart, process_cpu_usage_instant AS processCpuUsageInstant, process_cpu_usage_average AS processCpuUsageAverage, process_uptime AS processUptime, ` +
        'free_memory AS freeMemory, total_memory AS totalMemory, min_rss AS minRss, current_rss AS currentRss, ' +
        'max_rss AS maxRss, min_heap_total AS minHeapTotal, current_heap_total AS currentHeapTotal, ' +
        'max_heap_total AS maxHeapTotal, min_heap_used AS minHeapUsed, current_heap_used AS currentHeapUsed, ' +
        'max_heap_used AS maxHeapUsed, min_external AS minExternal, current_external AS currentExternal, ' +
        'max_external AS maxExternal, min_array_buffers AS minArrayBuffers, current_array_buffers AS currentArrayBuffers, ' +
        `max_array_buffers AS maxArrayBuffers FROM engine_metrics WHERE engine_id = ?;`
    );
    expect(nullMetrics).toBeNull();

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      processCpuUsageInstant: 1,
      processCpuUsageAverage: 1,
      processUptime: 2,
      freeMemory: 3,
      totalMemory: 4,
      minRss: 5,
      currentRss: 6,
      maxRss: 7,
      minHeapTotal: 8,
      currentHeapTotal: 9,
      maxHeapTotal: 10,
      minHeapUsed: 11,
      currentHeapUsed: 12,
      maxHeapUsed: 13,
      minExternal: 14,
      currentExternal: 15,
      maxExternal: 16,
      minArrayBuffers: 17,
      currentArrayBuffers: 18,
      maxArrayBuffers: 19
    });
    const metrics = repository.getMetrics('engineId');
    expect(metrics).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      processCpuUsageInstant: 1,
      processCpuUsageAverage: 1,
      processUptime: 2,
      freeMemory: 3,
      totalMemory: 4,
      minRss: 5,
      currentRss: 6,
      maxRss: 7,
      minHeapTotal: 8,
      currentHeapTotal: 9,
      maxHeapTotal: 10,
      minHeapUsed: 11,
      currentHeapUsed: 12,
      maxHeapUsed: 13,
      minExternal: 14,
      currentExternal: 15,
      maxExternal: 16,
      minArrayBuffers: 17,
      currentArrayBuffers: 18,
      maxArrayBuffers: 19
    });
  });

  it('should update metrics', () => {
    const newConnectorMetrics: EngineMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      processCpuUsageInstant: 1,
      processCpuUsageAverage: 1,
      processUptime: 2,
      freeMemory: 3,
      totalMemory: 4,
      minRss: 5,
      currentRss: 6,
      maxRss: 7,
      minHeapTotal: 8,
      currentHeapTotal: 9,
      maxHeapTotal: 10,
      minHeapUsed: 11,
      currentHeapUsed: 12,
      maxHeapUsed: 13,
      minExternal: 14,
      currentExternal: 15,
      maxExternal: 16,
      minArrayBuffers: 17,
      currentArrayBuffers: 18,
      maxArrayBuffers: 19
    };

    repository.updateMetrics('engineId', newConnectorMetrics);
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `UPDATE engine_metrics SET metrics_start = ?, process_cpu_usage_instant = ?, process_cpu_usage_average = ?, process_uptime = ?, free_memory = ?, ` +
        'total_memory = ?, min_rss = ?, current_rss = ?, max_rss = ?, min_heap_total = ?, current_heap_total = ?, ' +
        'max_heap_total = ?, min_heap_used = ?, current_heap_used = ?, max_heap_used = ?, min_external = ?, current_external = ?, ' +
        'max_external = ?, min_array_buffers = ?, current_array_buffers = ?, max_array_buffers = ? WHERE engine_id = ?;'
    );
    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.processCpuUsageInstant,
      newConnectorMetrics.processCpuUsageAverage,
      newConnectorMetrics.processUptime,
      newConnectorMetrics.freeMemory,
      newConnectorMetrics.totalMemory,
      newConnectorMetrics.minRss,
      newConnectorMetrics.currentRss,
      newConnectorMetrics.maxRss,
      newConnectorMetrics.minHeapTotal,
      newConnectorMetrics.currentHeapTotal,
      newConnectorMetrics.maxHeapTotal,
      newConnectorMetrics.minHeapUsed,
      newConnectorMetrics.currentHeapUsed,
      newConnectorMetrics.maxHeapUsed,
      newConnectorMetrics.minExternal,
      newConnectorMetrics.currentExternal,
      newConnectorMetrics.maxExternal,
      newConnectorMetrics.minArrayBuffers,
      newConnectorMetrics.currentArrayBuffers,
      newConnectorMetrics.maxArrayBuffers,
      'engineId'
    );
  });

  it('should delete metrics', () => {
    repository.removeMetrics('engineId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM engine_metrics WHERE engine_id = ?;');
    expect(run).toHaveBeenCalledWith('engineId');
  });
});
