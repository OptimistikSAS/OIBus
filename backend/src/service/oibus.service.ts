import DataStreamEngine from '../engine/data-stream-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import pino from 'pino';
import { EngineMetrics, EngineSettingsDTO, OIBusContent, OIBusInfo } from '../../shared/model/engine.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import EngineRepository from '../repository/config/engine.repository';
import { EngineSettings } from '../model/engine.model';
import { engineSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import EncryptionService from './encryption.service';
import LoggerService from './logger/logger.service';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import ProxyServer from '../web-server/proxy-server';
import { DateTime } from 'luxon';
import process from 'node:process';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import EngineMetricsRepository from '../repository/logs/engine-metrics.repository';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import { getOIBusInfo } from './utils';
import SouthService from './south.service';
import NorthService from './north.service';
import HistoryQueryService from './history-query.service';
import OIAnalyticsRegistrationService from './oia/oianalytics-registration.service';
import { EventEmitter } from 'node:events';

const HEALTH_SIGNAL_INTERVAL = 60_000_000; // 10 minutes
const UPDATE_ENGINE_METRICS_INTERVAL = 1000; // every second

export default class OIBusService {
  private _stream: PassThrough | null = null;

  private healthSignalInterval: NodeJS.Timeout | null = null;
  private updateEngineMetricsInterval: NodeJS.Timeout | null = null;
  private metrics: EngineMetrics;
  private cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation;
  private cpuUsageRef: NodeJS.CpuUsage = process.cpuUsage();

  private readonly proxyServer: ProxyServer;
  private logger: pino.Logger;

  public loggerEvent: EventEmitter = new EventEmitter(); // Used to trigger logger update for Web server
  public portChangeEvent: EventEmitter = new EventEmitter(); // Used to trigger port update for Web server

  constructor(
    protected readonly validator: JoiValidator,
    private engineRepository: EngineRepository,
    private engineMetricsRepository: EngineMetricsRepository,
    private ipFilterRepository: IpFilterRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private encryptionService: EncryptionService,
    private loggerService: LoggerService,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private southService: SouthService,
    private northService: NorthService,
    private historyQueryService: HistoryQueryService,
    private dataStreamEngine: DataStreamEngine,
    private historyQueryEngine: HistoryQueryEngine,
    private readonly ignoreIpFilters: boolean
  ) {
    this.metrics = this.engineMetricsRepository.getMetrics(this.getEngineSettings().id)!;

    this.logger = this.loggerService.createChildLogger('internal');
    this.proxyServer = new ProxyServer(this.logger, this.ignoreIpFilters);
    this.setLogger(this.logger);

    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', async () => {
      const engineSettings = this.getEngineSettings();
      if (engineSettings.logParameters.oia.level !== 'silent') {
        await this.resetLogger(engineSettings);
      }
    });
  }

  async startOIBus(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Starting OIBus...');

    await this.dataStreamEngine.start(
      this.northService.findAll().map(element => {
        return this.northService.runNorth(
          this.northService.findById(element.id)!,
          this.dataStreamEngine.logger.child({ scopeType: 'north', scopeId: element.id, scopeName: element.name })
        );
      }),
      this.southService.findAll().map(element => {
        return this.southService.runSouth(
          this.southService.findById(element.id)!,
          this.dataStreamEngine.addContent.bind(this.dataStreamEngine),
          this.dataStreamEngine.logger.child({ scopeType: 'south', scopeId: element.id, scopeName: element.name })
        );
      })
    );
    await this.historyQueryEngine.start(
      this.historyQueryService.findAll().map(element => {
        return this.historyQueryService.runHistoryQuery(element);
      })
    );

    const settings = this.getEngineSettings();
    this.cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation
    this.cpuUsageRef = process.cpuUsage();
    this.engineMetricsRepository.initMetrics(settings.id);
    this.metrics = this.engineMetricsRepository.getMetrics(settings.id)!;

    this.updateEngineMetricsInterval = setInterval(this.updateMetrics.bind(this), UPDATE_ENGINE_METRICS_INTERVAL);
    this.healthSignalInterval = setInterval(this.logHealthSignal.bind(this), HEALTH_SIGNAL_INTERVAL);
    this.logHealthSignal();

    if (settings.proxyEnabled) {
      const ipFilters = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...this.ipFilterRepository.findAll().map(filter => filter.address)];
      this.proxyServer.refreshIpFilters(ipFilters);
      await this.proxyServer.start(settings.proxyPort!);
    }
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus started in ${startDuration} ms`);
  }

  getEngineSettings(): EngineSettings {
    return this.engineRepository.get()!;
  }

  getOIBusInfo(): OIBusInfo {
    return getOIBusInfo(this.getEngineSettings());
  }

  getProxyServer(): ProxyServer {
    return this.proxyServer;
  }

  async updateEngineSettings(command: Omit<EngineSettings, 'id' | 'version' | 'launcherVersion'>): Promise<void> {
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
    const settings = this.getEngineSettings();

    if (
      !oldEngineSettings ||
      JSON.stringify(oldEngineSettings.logParameters) !== JSON.stringify(settings.logParameters) ||
      oldEngineSettings.name !== settings.name
    ) {
      await this.resetLogger(settings);
    }

    if (command.port !== oldEngineSettings.port) {
      this.portChangeEvent.emit('updated', settings.port);
    }
    await this.proxyServer.stop();
    if (settings.proxyEnabled) {
      await this.proxyServer.start(settings.proxyPort!);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  updateOIBusVersion(version: string): void {
    this.engineRepository.updateVersion(version);
  }

  updateOIBusLauncherVersion(version: string): void {
    this.engineRepository.updateLauncherVersion(version);
  }

  async resetLogger(settings: EngineSettings) {
    this.loggerService.stop();
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings();
    await this.loggerService.start(settings, registration);
    this.setLogger(this.loggerService.createChildLogger('internal'));

    this.loggerEvent.emit('updated', this.loggerService.createChildLogger('web-server'));
  }

  async restartOIBus(): Promise<void> {
    setTimeout(() => {
      process.exit();
    }, 100); // wait a bit to let the HTTP answer trigger
  }

  async stopOIBus(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Stopping OIBus...');
    await this.dataStreamEngine.stop();
    await this.historyQueryEngine.stop();
    if (this.healthSignalInterval) {
      clearInterval(this.healthSignalInterval);
      this.healthSignalInterval = null;
    }
    if (this.updateEngineMetricsInterval) {
      clearInterval(this.updateEngineMetricsInterval);
      this.updateEngineMetricsInterval = null;
    }
    this.loggerEvent.removeAllListeners();
    this.portChangeEvent.removeAllListeners();
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus stopped in ${startDuration} ms`);
  }

  async addExternalContent(northId: string, content: OIBusContent): Promise<void> {
    await this.dataStreamEngine.addExternalContent(northId, content);
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
    this.dataStreamEngine.setLogger(logger);
    this.historyQueryEngine.setLogger(logger);
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

    this.engineMetricsRepository.updateMetrics(this.getEngineSettings().id, this.metrics);
    this._stream?.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
  }

  resetMetrics(): void {
    const settings = this.getEngineSettings();
    this.engineMetricsRepository.removeMetrics(settings.id);
    this.engineMetricsRepository.initMetrics(settings.id);
    this.metrics = this.engineMetricsRepository.getMetrics(settings.id)!;
    this.updateMetrics();
  }

  resetNorthConnectorMetrics(northConnectorId: string): void {
    this.dataStreamEngine.resetNorthConnectorMetrics(northConnectorId);
  }

  resetSouthConnectorMetrics(southConnectorId: string): void {
    this.dataStreamEngine.resetSouthConnectorMetrics(southConnectorId);
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
    launcherVersion: engineSettings.launcherVersion,
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
