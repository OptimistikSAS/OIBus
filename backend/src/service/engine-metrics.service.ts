import pino from 'pino';
import { EngineMetrics } from '../../../shared/model/engine.model';
import os from 'node:os';
import process from 'node:process';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import { PassThrough } from 'node:stream';

export const HEALTH_SIGNAL_INTERVAL = 60_000_000; // 10 minutes
export const UPDATE_INTERVAL = 1000; // every second
/**
 * Class EngineMetricsService - sends metrics into logs and sse
 */
export default class EngineMetricsService {
  private _stream: PassThrough | null = null;

  private logSignalInterval: NodeJS.Timeout | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private _metrics: EngineMetrics;

  constructor(
    private _logger: pino.Logger,
    private readonly engineId: string,
    private readonly engineMetricsRepository: EngineMetricsRepository
  ) {
    this.engineMetricsRepository.initMetrics(this.engineId);
    this._metrics = this.engineMetricsRepository.getMetrics(this.engineId)!;
    this.initTimers();
  }

  private initTimers() {
    this.updateInterval = setInterval(this.updateMetrics.bind(this), UPDATE_INTERVAL);
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
    this._logger.info(JSON.stringify(this._metrics));
  }

  updateMetrics(): void {
    const processCpuUsage = process.cpuUsage();
    const processUpTime = Math.floor(process.uptime());
    const cpuUsagePercentage = (100 * (processCpuUsage.user + processCpuUsage.system)) / processUpTime;
    const memoryUsage = process.memoryUsage();

    const healthSignal: EngineMetrics = {
      metricsStart: this._metrics.metricsStart,
      processCpuUsage: cpuUsagePercentage,
      processUpTime: processUpTime,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      minRss: this._metrics.minRss > memoryUsage.rss ? memoryUsage.rss : this._metrics.minRss,
      currentRss: memoryUsage.rss,
      maxRss: this._metrics.maxRss < memoryUsage.rss ? memoryUsage.rss : this._metrics.maxRss,
      minHeapTotal: this._metrics.minHeapTotal > memoryUsage.heapTotal ? memoryUsage.heapTotal : this._metrics.minHeapTotal,
      currentHeapTotal: memoryUsage.heapTotal,
      maxHeapTotal: this._metrics.maxHeapTotal < memoryUsage.heapTotal ? memoryUsage.heapTotal : this._metrics.maxHeapTotal,
      minHeapUsed: this._metrics.minHeapUsed > memoryUsage.heapUsed ? memoryUsage.heapUsed : this._metrics.minHeapUsed,
      currentHeapUsed: memoryUsage.heapUsed,
      maxHeapUsed: this._metrics.maxHeapUsed < memoryUsage.heapUsed ? memoryUsage.heapUsed : this._metrics.maxHeapUsed,
      minExternal: this._metrics.minExternal > memoryUsage.external ? memoryUsage.external : this._metrics.minExternal,
      currentExternal: memoryUsage.external,
      maxExternal: this._metrics.maxExternal < memoryUsage.external ? memoryUsage.external : this._metrics.maxExternal,
      minArrayBuffers: this._metrics.minArrayBuffers > memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this._metrics.minArrayBuffers,
      currentArrayBuffers: memoryUsage.arrayBuffers,
      maxArrayBuffers: this._metrics.maxArrayBuffers < memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this._metrics.maxArrayBuffers
    };
    this._metrics = healthSignal;
    this.engineMetricsRepository.updateMetrics(this.engineId, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.engineMetricsRepository.removeMetrics(this.engineId);
    this.engineMetricsRepository.initMetrics(this.engineId);
  }

  /**
   * Stop the timers for sending health signal.
   */
  stop(): void {
    if (this.logSignalInterval) {
      clearInterval(this.logSignalInterval);
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();
    setTimeout(() => {
      this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
