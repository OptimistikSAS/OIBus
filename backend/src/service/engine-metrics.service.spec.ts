import EngineMetricsService, { HEALTH_SIGNAL_INTERVAL, UPDATE_INTERVAL } from './engine-metrics.service';

import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';
import os from 'node:os';

import EngineMetricsRepositoryMock from '../tests/__mocks__/engine-metrics-repository.mock';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import { EngineMetrics } from '../../../shared/model/engine.model';

jest.mock('./utils');
jest.mock('./oibus.service');

let service: EngineMetricsService;
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();
const engineMetricsRepository: EngineMetricsRepository = new EngineMetricsRepositoryMock();

describe('EngineMetrics service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(process, 'cpuUsage').mockReturnValue({ user: 1000, system: 1000 });
    jest.spyOn(process, 'uptime').mockReturnValue(10000);
    jest.spyOn(os, 'freemem').mockReturnValue(2_000_000);
    jest.spyOn(os, 'totalmem').mockReturnValue(16_000_000);
    jest
      .spyOn(process, 'memoryUsage')
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 })
      .mockReturnValueOnce({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 })
      .mockReturnValueOnce({ rss: 10, heapTotal: 10, heapUsed: 10, external: 10, arrayBuffers: 10 })
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 });
  });

  it('should init timers', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({ metricsStart: '2020-01-01T00:00:00.000' } as EngineMetrics);
    service = new EngineMetricsService(logger, 'engineId', engineMetricsRepository);

    expect(engineMetricsRepository.getMetrics).toHaveBeenCalledWith('engineId');
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it('should log metrics', async () => {
    service = new EngineMetricsService(logger, 'engineId', engineMetricsRepository);
    service.sendLoggingSignal();
    expect(logger.info).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);
    expect(logger.info).toHaveBeenCalledTimes(3);
  });

  it('should update metrics', async () => {
    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({
      metricsStart: '2020-01-01T00:00:00.000',
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 5,
      currentRss: 5,
      maxRss: 5,
      minHeapTotal: 5,
      currentHeapTotal: 5,
      maxHeapTotal: 5,
      minHeapUsed: 5,
      currentHeapUsed: 5,
      maxHeapUsed: 5,
      minExternal: 5,
      currentExternal: 5,
      maxExternal: 5,
      minArrayBuffers: 5,
      currentArrayBuffers: 5,
      maxArrayBuffers: 5
    });

    jest
      .spyOn(process, 'memoryUsage')
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 })
      .mockReturnValueOnce({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 })
      .mockReturnValueOnce({ rss: 10, heapTotal: 10, heapUsed: 10, external: 10, arrayBuffers: 10 })
      .mockReturnValueOnce({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 });

    service = new EngineMetricsService(logger, 'engineId', engineMetricsRepository);
    service.sendLoggingSignal();
    expect(engineMetricsRepository.updateMetrics).not.toHaveBeenCalled();
    jest.advanceTimersByTime(UPDATE_INTERVAL);
    jest.advanceTimersByTime(UPDATE_INTERVAL);
    jest.advanceTimersByTime(UPDATE_INTERVAL);
    jest.advanceTimersByTime(UPDATE_INTERVAL);

    expect(engineMetricsRepository.updateMetrics).toHaveBeenCalledTimes(4);
    expect(engineMetricsRepository.updateMetrics).toHaveBeenCalledWith('engineId', {
      metricsStart: '2020-01-01T00:00:00.000',
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 0,
      currentRss: 5,
      maxRss: 10,
      minHeapTotal: 0,
      currentHeapTotal: 5,
      maxHeapTotal: 10,
      minHeapUsed: 0,
      currentHeapUsed: 5,
      maxHeapUsed: 10,
      minExternal: 0,
      currentExternal: 5,
      maxExternal: 10,
      minArrayBuffers: 0,
      currentArrayBuffers: 5,
      maxArrayBuffers: 10
    });
  });

  it('should change logger and log metrics', async () => {
    jest.spyOn(process, 'memoryUsage').mockReturnValue({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 });
    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({
      metricsStart: '2020-01-01T00:00:00.000',
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 5,
      currentRss: 5,
      maxRss: 5,
      minHeapTotal: 5,
      currentHeapTotal: 5,
      maxHeapTotal: 5,
      minHeapUsed: 5,
      currentHeapUsed: 5,
      maxHeapUsed: 5,
      minExternal: 5,
      currentExternal: 5,
      maxExternal: 5,
      minArrayBuffers: 5,
      currentArrayBuffers: 5,
      maxArrayBuffers: 5
    });

    service = new EngineMetricsService(logger, 'engineId', engineMetricsRepository);
    service.sendLoggingSignal();
    expect(logger.info).toHaveBeenCalledTimes(2);
    service.setLogger(anotherLogger);

    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);

    expect(anotherLogger.info).toHaveBeenCalledWith(
      JSON.stringify({
        metricsStart: '2020-01-01T00:00:00.000',
        processCpuUsageInstant: 0,
        processCpuUsageAverage: 0.0000002,
        processUptime: 10000000,
        freeMemory: 2_000_000,
        totalMemory: 16_000_000,
        minRss: 0,
        currentRss: 5,
        maxRss: 10,
        minHeapTotal: 0,
        currentHeapTotal: 5,
        maxHeapTotal: 10,
        minHeapUsed: 0,
        currentHeapUsed: 5,
        maxHeapUsed: 10,
        minExternal: 0,
        currentExternal: 5,
        maxExternal: 10,
        minArrayBuffers: 0,
        currentArrayBuffers: 5,
        maxArrayBuffers: 10
      })
    );
  });

  it('should get stream', () => {
    jest.spyOn(process, 'memoryUsage').mockReturnValue({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 });
    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({
      metricsStart: '2020-01-01T00:00:00.000',
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 5,
      currentRss: 5,
      maxRss: 5,
      minHeapTotal: 5,
      currentHeapTotal: 5,
      maxHeapTotal: 5,
      minHeapUsed: 5,
      currentHeapUsed: 5,
      maxHeapUsed: 5,
      minExternal: 5,
      currentExternal: 5,
      maxExternal: 5,
      minArrayBuffers: 5,
      currentArrayBuffers: 5,
      maxArrayBuffers: 5
    });
    service = new EngineMetricsService(logger, 'engineId', engineMetricsRepository);

    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    service.updateMetrics();
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        metricsStart: '2020-01-01T00:00:00.000',
        processCpuUsageInstant: 0,
        processCpuUsageAverage: 0.0000002,
        processUptime: 10000,
        freeMemory: 2_000_000,
        totalMemory: 16_000_000,
        minRss: 5,
        currentRss: 5,
        maxRss: 5,
        minHeapTotal: 5,
        currentHeapTotal: 5,
        maxHeapTotal: 5,
        minHeapUsed: 5,
        currentHeapUsed: 5,
        maxHeapUsed: 5,
        minExternal: 5,
        currentExternal: 5,
        maxExternal: 5,
        minArrayBuffers: 5,
        currentArrayBuffers: 5,
        maxArrayBuffers: 5
      })}\n\n`
    );

    expect(service.stream).toBeDefined();
  });

  it('should reset engine metrics', () => {
    service.resetMetrics();
    expect(engineMetricsRepository.removeMetrics).toHaveBeenCalledWith('engineId');
    expect(engineMetricsRepository.initMetrics).toHaveBeenCalledWith('engineId');
  });
});
