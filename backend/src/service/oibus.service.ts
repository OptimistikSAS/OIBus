import DataStreamEngine from '../engine/data-stream-engine';
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  EngineLoggerCommandDTO,
  EngineMetrics,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  EngineSettingsUpdateResultDTO,
  EngineWebServerCommandDTO,
  FileCacheContent,
  OIBusContent,
  OIBusInfo
} from '../../shared/model/engine.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import EngineRepository from '../repository/config/engine.repository';
import { EngineSettings } from '../model/engine.model';
import { GetUserInfo } from '../../shared/model/types';
import {
  engineLoggerSchema,
  engineNameSchema,
  engineProxySchema,
  engineSchema,
  engineWebServerSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import { encryptionService } from './encryption.service';
import argon2 from 'argon2';
import LoggerService from './logger/logger.service';
import type { ILogger } from '../model/logger.model';
import type { IOIAnalyticsMessageService } from '../model/oianalytics-message.model';
import ProxyServer from '../web-server/proxy-server';
import { DateTime } from 'luxon';
import process from 'node:process';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import { getOIBusInfo } from './utils';
import SouthService from './south.service';
import NorthService from './north.service';
import HistoryQueryService from './history-query.service';
import OIAnalyticsRegistrationService from './oia/oianalytics-registration.service';
import { EventEmitter } from 'node:events';
import IPFilterService from './ip-filter.service';
import UserService from './user.service';
const HEALTH_SIGNAL_INTERVAL = 1_800_000; // 30 minutes
const UPDATE_ENGINE_METRICS_INTERVAL = 1000; // every second

export default class OIBusService {
  private _stream: PassThrough | null = null;

  private healthSignalInterval: NodeJS.Timeout | null = null;
  private updateEngineMetricsInterval: NodeJS.Timeout | null = null;
  private metrics: EngineMetrics;
  // The persisted metrics row is initialised with all-zero min/max gauges. Math.min(0, x)
  // would otherwise pin every min* at 0 forever, so the first sample of each run seeds
  // min/max/current from the live measurement instead of folding in the zero sentinel.
  private engineMetricsSeeded = false;
  private cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation;
  private cpuUsageRef: NodeJS.CpuUsage = process.cpuUsage();

  private readonly proxyServer: ProxyServer;
  private readonly logger: ILogger;

  public loggerEvent: EventEmitter = new EventEmitter(); // Used to trigger logger update for Web server
  public portChangeEvent: EventEmitter = new EventEmitter(); // Used to trigger port update for Web server

  constructor(
    protected readonly validator: JoiValidator,
    private engineRepository: EngineRepository,
    private engineMetricsRepository: EngineMetricsRepository,
    private ipFilterService: IPFilterService,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private loggerService: LoggerService,
    private oIAnalyticsMessageService: IOIAnalyticsMessageService,
    private southService: SouthService,
    private northService: NorthService,
    private historyQueryService: HistoryQueryService,
    private userService: UserService,
    private engine: DataStreamEngine,
    private readonly ignoreIpFilters: boolean
  ) {
    this.metrics = this.engineMetricsRepository.getMetrics(this.getEngineSettings().id)!;
    this.logger = this.loggerService.createChildLogger('internal');
    this.proxyServer = new ProxyServer(this.ignoreIpFilters);

    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', async () => {
      const engineSettings = this.getEngineSettings();
      if (engineSettings.logParameters.oia.level !== 'silent') {
        await this.resetLogger(engineSettings);
      }
    });

    this.ipFilterService.whiteListEvent.on('update-white-list', (newWhiteList: Array<string>) => {
      const engineSettings = this.getEngineSettings();
      if (engineSettings.proxyEnabled) {
        this.proxyServer.refreshIpFilters(newWhiteList);
      }
    });
  }

  async start(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Starting OIBus...');

    await this.engine.start(this.northService.list(), this.southService.list(), this.historyQueryService.list());

    const settings = this.getEngineSettings();
    this.cpuUsageRefInstant = DateTime.now().toMillis(); // Reference between two dates for cpu usage calculation
    this.cpuUsageRef = process.cpuUsage();
    this.engineMetricsRepository.initMetrics(settings.id);
    this.metrics = this.engineMetricsRepository.getMetrics(settings.id)!;
    this.engineMetricsSeeded = false;

    this.updateEngineMetricsInterval = setInterval(this.updateEngineMetrics.bind(this), UPDATE_ENGINE_METRICS_INTERVAL);
    this.healthSignalInterval = setInterval(this.logHealthSignal.bind(this), HEALTH_SIGNAL_INTERVAL);
    this.logHealthSignal();

    if (settings.proxyEnabled) {
      this.proxyServer.refreshIpFilters([
        '127.0.0.1',
        '::1',
        '::ffff:127.0.0.1',
        ...this.ipFilterService.list().map(filter => filter.address)
      ]);
      await this.proxyServer.start(
        settings.proxyPort!,
        {
          url: settings.forwardProxyUrl,
          username: settings.forwardProxyUsername,
          password: settings.forwardProxyPassword ? await encryptionService.decryptText(settings.forwardProxyPassword) : null
        },
        {
          username: settings.proxyUsername,
          password: settings.proxyPassword
        }
      );
    }
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus started in ${startDuration} ms`);
  }

  getEngineSettings(): EngineSettings {
    return this.engineRepository.get()!;
  }

  getInfo(): OIBusInfo {
    return getOIBusInfo(toEngineSettingsDTO(this.getEngineSettings(), id => this.userService.getUserInfo(id)));
  }

  getProxyServer(): ProxyServer {
    return this.proxyServer;
  }

  async updateEngineSettings(command: EngineSettingsCommandDTO, updatedBy: string): Promise<EngineSettingsUpdateResultDTO> {
    await this.validator.validate(engineSchema, command);

    if (command.port === command.proxyPort) {
      throw new Error('Web server port and proxy port can not be the same');
    }

    const oldEngineSettings = this.getEngineSettings();

    if (!command.logParameters.loki.password) {
      command.logParameters.loki.password = oldEngineSettings.logParameters.loki.password;
    } else {
      command.logParameters.loki.password = await encryptionService.encryptText(command.logParameters.loki.password);
    }
    if (!command.forwardProxyPassword) {
      command.forwardProxyPassword = oldEngineSettings.forwardProxyPassword;
    } else {
      command.forwardProxyPassword = await encryptionService.encryptText(command.forwardProxyPassword);
    }
    if (!command.proxyPassword) {
      command.proxyPassword = oldEngineSettings.proxyPassword;
    } else {
      command.proxyPassword = await argon2.hash(command.proxyPassword);
    }
    this.engineRepository.update(command, updatedBy);
    const settings = this.getEngineSettings();

    if (
      JSON.stringify(oldEngineSettings.logParameters) !== JSON.stringify(settings.logParameters) ||
      oldEngineSettings.name !== settings.name
    ) {
      await this.resetLogger(settings);
    }

    const portChanged = command.port !== oldEngineSettings.port;
    if (portChanged) {
      // Emit the port change event asynchronously to ensure the HTTP response is sent first
      setImmediate(() => {
        this.portChangeEvent.emit('updated', settings.port);
      });
    }
    await this.proxyServer.stop();
    if (settings.proxyEnabled) {
      await this.proxyServer.start(
        settings.proxyPort!,
        {
          url: settings.forwardProxyUrl,
          username: settings.forwardProxyUsername,
          password: settings.forwardProxyPassword ? await encryptionService.decryptText(settings.forwardProxyPassword) : null
        },
        {
          username: settings.proxyUsername,
          password: settings.proxyPassword
        }
      );
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    return {
      needsRedirect: portChanged,
      newPort: portChanged ? settings.port : null
    };
  }

  async updateEngineName(command: EngineNameCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineNameSchema, command);
    this.engineRepository.updateName(command.name, updatedBy);
    const settings = this.getEngineSettings();
    await this.resetLogger(settings);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async updateEngineWebServer(command: EngineWebServerCommandDTO, updatedBy: string): Promise<EngineSettingsUpdateResultDTO> {
    await this.validator.validate(engineWebServerSchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (command.port === oldEngineSettings.proxyPort) {
      throw new Error('Web server port and proxy port can not be the same');
    }
    this.engineRepository.updateWebServer(command, updatedBy);
    const settings = this.getEngineSettings();
    const portChanged = command.port !== oldEngineSettings.port;
    if (portChanged) {
      setImmediate(() => {
        this.portChangeEvent.emit('updated', settings.port);
      });
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return {
      needsRedirect: portChanged,
      newPort: portChanged ? settings.port : null
    };
  }

  async updateEngineProxy(command: EngineProxyCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineProxySchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (command.proxyEnabled && command.proxyPort === oldEngineSettings.port) {
      throw new Error('Web server port and proxy port can not be the same');
    }
    if (!command.forwardProxyPassword) {
      command.forwardProxyPassword = oldEngineSettings.forwardProxyPassword;
    } else {
      command.forwardProxyPassword = await encryptionService.encryptText(command.forwardProxyPassword);
    }
    if (!command.proxyPassword) {
      command.proxyPassword = oldEngineSettings.proxyPassword;
    } else {
      command.proxyPassword = await argon2.hash(command.proxyPassword);
    }
    this.engineRepository.updateProxy(command, updatedBy);
    const settings = this.getEngineSettings();
    await this.proxyServer.stop();
    if (settings.proxyEnabled) {
      await this.proxyServer.start(
        settings.proxyPort!,
        {
          url: settings.forwardProxyUrl,
          username: settings.forwardProxyUsername,
          password: settings.forwardProxyPassword ? await encryptionService.decryptText(settings.forwardProxyPassword) : null
        },
        {
          username: settings.proxyUsername,
          password: settings.proxyPassword
        }
      );
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async updateEngineLogger(command: EngineLoggerCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineLoggerSchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (!command.loki.password) {
      command.loki.password = oldEngineSettings.logParameters.loki.password;
    } else {
      command.loki.password = await encryptionService.encryptText(command.loki.password);
    }
    this.engineRepository.updateLogger(command, updatedBy);
    const settings = this.getEngineSettings();
    await this.resetLogger(settings);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  updateOIBusVersion(version: string, launcherVersion: string): void {
    this.engineRepository.updateVersion(version, launcherVersion);
  }

  async resetLogger(settings: EngineSettings) {
    await this.loggerService.stop();
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings();
    await this.loggerService.start(settings, registration);
    this.loggerEvent.emit('updated', this.loggerService.createChildLogger('internal', 'web-server'));
  }

  restart(): void {
    setTimeout(() => {
      process.exit();
    }, 100); // wait a bit to let the HTTP answer trigger
  }

  async stop(): Promise<void> {
    const start = DateTime.now().toMillis();
    this.logger.info('Stopping OIBus...');
    await this.engine.stop();
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

  async addExternalContent(northId: string, dataSourceId: string, content: OIBusContent): Promise<void> {
    await this.engine.addExternalContent(northId, dataSourceId, content);
  }

  logHealthSignal(): void {
    this.logger.info(JSON.stringify(this.metrics));
  }

  updateEngineMetrics(): void {
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
    // On the first sample of a run, seed min/max with the live value instead of folding
    // in the persisted zero sentinel (which would pin every min* at 0 via Math.min).
    const seeding = !this.engineMetricsSeeded;
    this.engineMetricsSeeded = true;
    const trackMin = (stored: number, current: number): number => (seeding ? current : Math.min(stored, current));
    const trackMax = (stored: number, current: number): number => (seeding ? current : Math.max(stored, current));
    this.metrics = {
      metricsStart: this.metrics.metricsStart,
      processCpuUsageInstant: instantCpuUsagePercent,
      processCpuUsageAverage: averageCpuUsagePercent,
      processUptime: processUptime,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      minRss: trackMin(this.metrics.minRss, memoryUsage.rss),
      currentRss: memoryUsage.rss,
      maxRss: trackMax(this.metrics.maxRss, memoryUsage.rss),
      minHeapTotal: trackMin(this.metrics.minHeapTotal, memoryUsage.heapTotal),
      currentHeapTotal: memoryUsage.heapTotal,
      maxHeapTotal: trackMax(this.metrics.maxHeapTotal, memoryUsage.heapTotal),
      minHeapUsed: trackMin(this.metrics.minHeapUsed, memoryUsage.heapUsed),
      currentHeapUsed: memoryUsage.heapUsed,
      maxHeapUsed: trackMax(this.metrics.maxHeapUsed, memoryUsage.heapUsed),
      minExternal: trackMin(this.metrics.minExternal, memoryUsage.external),
      currentExternal: memoryUsage.external,
      maxExternal: trackMax(this.metrics.maxExternal, memoryUsage.external),
      minArrayBuffers: trackMin(this.metrics.minArrayBuffers, memoryUsage.arrayBuffers),
      currentArrayBuffers: memoryUsage.arrayBuffers,
      maxArrayBuffers: trackMax(this.metrics.maxArrayBuffers, memoryUsage.arrayBuffers)
    };

    this.engineMetricsRepository.updateMetrics(this.getEngineSettings().id, this.metrics);
    this._stream?.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
  }

  resetEngineMetrics(): void {
    const settings = this.getEngineSettings();
    this.engineMetricsRepository.removeMetrics(settings.id);
    this.engineMetricsRepository.initMetrics(settings.id);
    this.metrics = this.engineMetricsRepository.getMetrics(settings.id)!;
    // The row was just reset to zeros — reseed min/max from the next live sample.
    this.engineMetricsSeeded = false;
    this.updateEngineMetrics();
  }

  resetNorthMetrics(northId: string): void {
    this.engine.resetNorthMetrics(northId);
  }

  resetSouthMetrics(southId: string): void {
    this.engine.resetSouthMetrics(southId);
  }

  async searchCacheContent(type: 'north' | 'history', id: string, searchParams: CacheSearchParam): Promise<CacheSearchResult> {
    return await this.engine.searchCacheContent(type, id, searchParams);
  }

  async getFileFromCache(type: 'north' | 'history', id: string, folder: DataFolderType, filename: string): Promise<FileCacheContent> {
    return await this.engine.getFileFromCache(type, id, folder, filename);
  }

  async updateCacheContent(type: 'north' | 'history', id: string, updateCommand: CacheContentUpdateCommand): Promise<void> {
    return await this.engine.updateCacheContent(type, id, updateCommand);
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();
    setTimeout(() => {
      this._stream?.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}

/* c8 ignore next */
export const toEngineSettingsDTO = (engineSettings: EngineSettings, getUserInfo: GetUserInfo): EngineSettingsDTO => {
  return {
    id: engineSettings.id,
    createdBy: getUserInfo(engineSettings.createdBy),
    updatedBy: getUserInfo(engineSettings.updatedBy),
    createdAt: engineSettings.createdAt,
    updatedAt: engineSettings.updatedAt,
    name: engineSettings.name,
    port: engineSettings.port,
    version: engineSettings.version,
    launcherVersion: engineSettings.launcherVersion,
    proxyEnabled: engineSettings.proxyEnabled,
    proxyPort: engineSettings.proxyPort,
    forwardProxyUrl: engineSettings.forwardProxyUrl,
    forwardProxyUsername: engineSettings.forwardProxyUsername,
    forwardProxyPassword: '',
    proxyUsername: engineSettings.proxyUsername,
    proxyPassword: '',
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
      },
      syslog: {
        level: engineSettings.logParameters.syslog.level,
        host: engineSettings.logParameters.syslog.host,
        port: engineSettings.logParameters.syslog.port,
        protocol: engineSettings.logParameters.syslog.protocol
      }
    }
  };
};
