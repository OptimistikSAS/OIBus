import pino from 'pino';
import { HealthSignalContent } from '../../../shared/model/engine.model';
import os from 'node:os';
import process from 'node:process';

export const HEALTH_SIGNAL_INTERVAL = 60_000_000; // 10 minutes
/**
 * Class HealthSignal - sends health signal to a remote host or into the logs
 */
export default class HealthSignalService {
  private logSignalInterval: NodeJS.Timeout | null = null;
  private oibusMetrics: HealthSignalContent;
  constructor(private _logger: pino.Logger) {
    const processCpuUsage = process.cpuUsage();
    const processUptime = Math.floor(process.uptime());
    const cpuUsagePercentage = (100 * (processCpuUsage.user + processCpuUsage.system)) / processUptime;
    const memoryUsage = process.memoryUsage();

    this.oibusMetrics = {
      processCpuUsage: cpuUsagePercentage,
      processUptime: processUptime,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      minRss: memoryUsage.rss,
      currentRss: memoryUsage.rss,
      maxRss: memoryUsage.rss,
      minHeapTotal: memoryUsage.heapTotal,
      currentHeapTotal: memoryUsage.heapTotal,
      maxHeapTotal: memoryUsage.heapTotal,
      minHeapUsed: memoryUsage.heapUsed,
      currentHeapUsed: memoryUsage.heapUsed,
      maxHeapUsed: memoryUsage.heapUsed,
      minExternal: memoryUsage.external,
      currentExternal: memoryUsage.external,
      maxExternal: memoryUsage.external,
      minArrayBuffers: memoryUsage.arrayBuffers,
      currentArrayBuffers: memoryUsage.arrayBuffers,
      maxArrayBuffers: memoryUsage.arrayBuffers
    };
    this.initTimers();
  }

  private initTimers() {
    this.sendLoggingSignal();
    this.logSignalInterval = setInterval(this.sendLoggingSignal.bind(this), HEALTH_SIGNAL_INTERVAL);
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  /**
   * Log the health signal (info level)
   */
  sendLoggingSignal(): void {
    const processCpuUsage = process.cpuUsage();
    const processUptime = Math.floor(process.uptime());
    const cpuUsagePercentage = (100 * (processCpuUsage.user + processCpuUsage.system)) / processUptime;
    const memoryUsage = process.memoryUsage();

    const healthSignal = {
      processCpuUsage: cpuUsagePercentage,
      processUptime: processUptime,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      minRss: this.oibusMetrics.minRss > memoryUsage.rss ? memoryUsage.rss : this.oibusMetrics.minRss,
      currentRss: memoryUsage.rss,
      maxRss: this.oibusMetrics.maxRss < memoryUsage.rss ? memoryUsage.rss : this.oibusMetrics.maxRss,
      minHeapTotal: this.oibusMetrics.minHeapTotal > memoryUsage.heapTotal ? memoryUsage.heapTotal : this.oibusMetrics.minHeapTotal,
      currentHeapTotal: memoryUsage.heapTotal,
      maxHeapTotal: this.oibusMetrics.maxHeapTotal < memoryUsage.heapTotal ? memoryUsage.heapTotal : this.oibusMetrics.maxHeapTotal,
      minHeapUsed: this.oibusMetrics.minHeapUsed > memoryUsage.heapUsed ? memoryUsage.heapUsed : this.oibusMetrics.minHeapUsed,
      currentHeapUsed: memoryUsage.heapUsed,
      maxHeapUsed: this.oibusMetrics.maxHeapUsed < memoryUsage.heapUsed ? memoryUsage.heapUsed : this.oibusMetrics.maxHeapUsed,
      minExternal: this.oibusMetrics.minExternal > memoryUsage.external ? memoryUsage.external : this.oibusMetrics.minExternal,
      currentExternal: memoryUsage.external,
      maxExternal: this.oibusMetrics.maxExternal < memoryUsage.external ? memoryUsage.external : this.oibusMetrics.maxExternal,
      minArrayBuffers:
        this.oibusMetrics.minArrayBuffers > memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this.oibusMetrics.minArrayBuffers,
      currentArrayBuffers: memoryUsage.arrayBuffers,
      maxArrayBuffers:
        this.oibusMetrics.maxArrayBuffers < memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this.oibusMetrics.maxArrayBuffers
    };
    this.oibusMetrics = healthSignal;
    this._logger.info(JSON.stringify(healthSignal));
  }

  /**
   * Stop the timers for sending health signal.
   */
  stop(): void {
    if (this.logSignalInterval) {
      clearInterval(this.logSignalInterval);
    }
  }
}
