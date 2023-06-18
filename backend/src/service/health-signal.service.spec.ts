import HealthSignalService, { HEALTH_SIGNAL_INTERVAL } from './health-signal.service';

import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';
import os from 'node:os';

jest.mock('./utils');
jest.mock('./oibus.service');

let service: HealthSignalService;
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

describe('HealthSignal service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('with signals enabled should init timers', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service = new HealthSignalService(logger);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    await service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should log health signal', async () => {
    service = new HealthSignalService(logger);
    service.sendLoggingSignal();
    expect(logger.info).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);
    expect(logger.info).toHaveBeenCalledTimes(3);
  });

  it('should change logger and log health signal', async () => {
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

    service = new HealthSignalService(logger);
    service.sendLoggingSignal();
    expect(logger.info).toHaveBeenCalledTimes(2);
    service.setLogger(anotherLogger);

    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(HEALTH_SIGNAL_INTERVAL);

    expect(anotherLogger.info).toHaveBeenCalledWith(
      JSON.stringify({
        processCpuUsage: 20,
        processUptime: 10000,
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
});
