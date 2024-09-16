import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import pino from 'pino';
import { EngineMetrics, EngineSettingsDTO, OIBusContent, OIBusInfo } from '../../../shared/model/engine.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import EngineRepository from '../repository/engine.repository';
import { EngineSettings } from '../model/engine.model';
import { engineSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import EncryptionService from './encryption.service';
import LoggerService from './logger/logger.service';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import ProxyServer from '../web-server/proxy-server';
import OIAnalyticsRegistrationRepository from '../repository/oianalytics-registration.repository';
import { DateTime } from 'luxon';
import process from 'node:process';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import IpFilterRepository from '../repository/ip-filter.repository';
import { getOIBusInfo } from './utils';

const HEALTH_SIGNAL_INTERVAL = 60_000_000; // 10 minutes
const UPDATE_ENGINE_METRICS_INTERVAL = 1000; // every second

export default class OIBusService {
  private webServerChangeLoggerCallback: (logger: pino.Logger) => void = () => {};
  private webServerChangePortCallback: (port: number) => Promise<void> = () => Promise.resolve();

  private _stream: PassThrough | null = null;

  private settings: EngineSettings;

  private healthSignalInterval: NodeJS.Timeout | null = null;
  private updateEngineMetricsInterval: NodeJS.Timeout | null = null;
  private metrics: EngineMetrics;
  private cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation;
  private cpuUsageRef: NodeJS.CpuUsage = process.cpuUsage();

  private readonly proxyServer: ProxyServer;
  private logger: pino.Logger;

  constructor(
    protected readonly validator: JoiValidator,
    private engineRepository: EngineRepository,
    private engineMetricsRepository: EngineMetricsRepository,
    private ipFilterRepository: IpFilterRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private encryptionService: EncryptionService,
    private loggerService: LoggerService,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private engine: OIBusEngine,
    private historyEngine: HistoryQueryEngine
  ) {
    this.settings = this.getEngineSettings();
    this.metrics = this.engineMetricsRepository.getMetrics(this.settings.id)!;

    this.logger = this.loggerService.createChildLogger('internal');
    this.proxyServer = new ProxyServer(this.logger);
    this.setLogger(this.logger);
  }

  async startOIBus(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Starting OIBus...');
    await this.engine.start();
    await this.historyEngine.start();

    this.cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation
    this.cpuUsageRef = process.cpuUsage();
    this.engineMetricsRepository.initMetrics(this.settings.id);
    this.metrics = this.engineMetricsRepository.getMetrics(this.settings.id)!;

    this.updateEngineMetricsInterval = setInterval(this.updateMetrics.bind(this), UPDATE_ENGINE_METRICS_INTERVAL);
    this.healthSignalInterval = setInterval(this.logHealthSignal.bind(this), HEALTH_SIGNAL_INTERVAL);
    this.logHealthSignal();

    if (this.settings.proxyEnabled) {
      const ipFilters = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...this.ipFilterRepository.findAll().map(filter => filter.address)];
      this.proxyServer.refreshIpFilters(ipFilters);
      await this.proxyServer.start(this.settings.proxyPort!);
    }
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus started in ${startDuration} ms`);
  }

  getEngineSettings(): EngineSettings {
    return this.engineRepository.get()!;
  }

  getOIBusInfo(): OIBusInfo {
    return getOIBusInfo(this.settings);
  }

  getProxyServer(): ProxyServer {
    return this.proxyServer;
  }

  async updateEngineSettings(command: Omit<EngineSettings, 'id' | 'version'>): Promise<void> {
    await this.validator.validate(engineSchema, command);

    if (command.port === command.proxyPort) {
      throw new Error('Web server port and proxy port can not be the same');
    }

    const oldEngineSettings = this.getEngineSettings();

    if (!command.logParameters.loki.password) {
      command.logParameters.loki.password = oldEngineSettings.logParameters.loki.password;
    } else {
      command.logParameters.loki.password = await this.encryptionService.encryptText(command.logParameters.loki.password);
    }
    this.engineRepository.update(command);
    this.settings = this.getEngineSettings();

    if (
      !oldEngineSettings ||
      JSON.stringify(oldEngineSettings.logParameters) !== JSON.stringify(this.settings.logParameters) ||
      oldEngineSettings.name !== this.settings.name
    ) {
      await this.resetLogger(this.settings);
    }

    await this.webServerChangePortCallback(this.settings.port);
    await this.proxyServer.stop();
    if (this.settings.proxyEnabled) {
      await this.proxyServer.start(this.settings.proxyPort!);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  updateOIBusVersion(version: string): void {
    this.engineRepository.updateVersion(version);
  }

  async resetLogger(settings: EngineSettings) {
    this.loggerService.stop();
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    await this.loggerService.start(settings, registration);
    this.setLogger(this.loggerService.createChildLogger('internal'));
    this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
  }

  setWebServerChangeLogger(callback: (logger: pino.Logger) => void): void {
    this.webServerChangeLoggerCallback = callback;
  }

  setWebServerChangePort(callback: (port: number) => Promise<void>): void {
    this.webServerChangePortCallback = callback;
  }

  async restartOIBus(): Promise<void> {
    await this.stopOIBus();
    await this.startOIBus();
  }

  async stopOIBus(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Stopping OIBus...');
    await this.engine.stop();
    await this.historyEngine.stop();
    if (this.healthSignalInterval) {
      clearInterval(this.healthSignalInterval);
      this.healthSignalInterval = null;
    }
    if (this.updateEngineMetricsInterval) {
      clearInterval(this.updateEngineMetricsInterval);
      this.updateEngineMetricsInterval = null;
    }
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus stopped in ${startDuration} ms`);
  }

  async addExternalContent(northId: string, content: OIBusContent): Promise<void> {
    await this.engine.addExternalContent(northId, content);
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
    this.engine.setLogger(logger);
    this.historyEngine.setLogger(logger);
    this.proxyServer.setLogger(logger);
    this.oIAnalyticsMessageService.setLogger(logger);
  }

  /**
   * Log the health signal (info level)
   */
  logHealthSignal(): void {
    this.logger.info(JSON.stringify(this.metrics));
  }

  updateMetrics(): void {
    const newRefInstant = DateTime.now().toMillis();
    const cpuUsage = process.cpuUsage();
    const processUptime = process.uptime() * 1000; // number of ms

    // Time is *1000 because cpuUsage is in us (microseconds)
    const instantCpuUsagePercent =
      (cpuUsage.user - this.cpuUsageRef.user + cpuUsage.system - this.cpuUsageRef.system) /
      ((newRefInstant - this.cpuUsageRefInstant) * 1000);
    const averageCpuUsagePercent = (cpuUsage.user + cpuUsage.system) / (processUptime * 1000);

    this.cpuUsageRef = cpuUsage;
    this.cpuUsageRefInstant = newRefInstant;

    const memoryUsage = process.memoryUsage();
    this.metrics = {
      metricsStart: this.metrics.metricsStart,
      processCpuUsageInstant: instantCpuUsagePercent,
      processCpuUsageAverage: averageCpuUsagePercent,
      processUptime: processUptime,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      minRss: this.metrics.minRss > memoryUsage.rss ? memoryUsage.rss : this.metrics.minRss,
      currentRss: memoryUsage.rss,
      maxRss: this.metrics.maxRss < memoryUsage.rss ? memoryUsage.rss : this.metrics.maxRss,
      minHeapTotal: this.metrics.minHeapTotal > memoryUsage.heapTotal ? memoryUsage.heapTotal : this.metrics.minHeapTotal,
      currentHeapTotal: memoryUsage.heapTotal,
      maxHeapTotal: this.metrics.maxHeapTotal < memoryUsage.heapTotal ? memoryUsage.heapTotal : this.metrics.maxHeapTotal,
      minHeapUsed: this.metrics.minHeapUsed > memoryUsage.heapUsed ? memoryUsage.heapUsed : this.metrics.minHeapUsed,
      currentHeapUsed: memoryUsage.heapUsed,
      maxHeapUsed: this.metrics.maxHeapUsed < memoryUsage.heapUsed ? memoryUsage.heapUsed : this.metrics.maxHeapUsed,
      minExternal: this.metrics.minExternal > memoryUsage.external ? memoryUsage.external : this.metrics.minExternal,
      currentExternal: memoryUsage.external,
      maxExternal: this.metrics.maxExternal < memoryUsage.external ? memoryUsage.external : this.metrics.maxExternal,
      minArrayBuffers: this.metrics.minArrayBuffers > memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this.metrics.minArrayBuffers,
      currentArrayBuffers: memoryUsage.arrayBuffers,
      maxArrayBuffers: this.metrics.maxArrayBuffers < memoryUsage.arrayBuffers ? memoryUsage.arrayBuffers : this.metrics.maxArrayBuffers
    };
    this.engineMetricsRepository.updateMetrics(this.settings.id, this.metrics);
    this._stream?.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.engineMetricsRepository.removeMetrics(this.settings.id);
    this.engineMetricsRepository.initMetrics(this.settings.id);
    this.updateMetrics();
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();
    setTimeout(() => {
      this._stream!.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}

export const toEngineSettingsDTO = (engineSettings: EngineSettings): EngineSettingsDTO => {
  return {
    id: engineSettings.id,
    name: engineSettings.name,
    port: engineSettings.port,
    version: engineSettings.version,
    proxyEnabled: engineSettings.proxyEnabled,
    proxyPort: engineSettings.proxyPort,
    logParameters: {
      console: {
        level: engineSettings.logParameters.console.level
      },
      file: {
        level: engineSettings.logParameters.file.level,
        maxFileSize: engineSettings.logParameters.file.maxFileSize,
        numberOfFiles: engineSettings.logParameters.file.numberOfFiles
      },
      database: {
        level: engineSettings.logParameters.database.level,
        maxNumberOfLogs: engineSettings.logParameters.database.maxNumberOfLogs
      },

      loki: {
        level: engineSettings.logParameters.loki.level,
        interval: engineSettings.logParameters.loki.interval,
        address: engineSettings.logParameters.loki.address,
        username: engineSettings.logParameters.loki.username,
        password: ''
      },
      oia: {
        level: engineSettings.logParameters.oia.level,
        interval: engineSettings.logParameters.oia.interval
      }
    }
  };
};
