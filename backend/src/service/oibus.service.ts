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
    private readonly ignoreIpFilters: boolean,
    private readonly ignoreRemoteUpdate: boolean
  ) {
    this.metrics = this.engineMetricsRepository.getMetrics(this.getEngineSettings().id)!;
    this.logger = this.loggerService.createChildLogger('internal');
    this.proxyServer = new ProxyServer(this.ignoreIpFilters);

    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', async () => {
      const engineSettings = this.getEngineSettings();
      if (engineSettings.logger.oia.level !== 'silent') {
        await this.resetLogger(engineSettings);
      }
    });

    this.ipFilterService.whiteListEvent.on('update-white-list', (newWhiteList: Array<string>) => {
      const engineSettings = this.getEngineSettings();
      if (engineSettings.proxyServer.enabled) {
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

    if (settings.proxyServer.enabled) {
      this.proxyServer.refreshIpFilters([
        '127.0.0.1',
        '::1',
        '::ffff:127.0.0.1',
        ...this.ipFilterService.list().map(filter => filter.address)
      ]);
      this.proxyServer.start(settings.proxyServer);
    }
    const startDuration = DateTime.now().toMillis() - start;
    this.logger.info(`OIBus started in ${startDuration} ms`);
  }

  getEngineSettings(): EngineSettings {
    return this.engineRepository.get()!;
  }

  getInfo(): OIBusInfo {
    return getOIBusInfo(
      toEngineSettingsDTO(this.getEngineSettings(), id => this.userService.getUserInfo(id)),
      this.ignoreIpFilters,
      this.ignoreRemoteUpdate
    );
  }

  getProxyServer(): ProxyServer {
    return this.proxyServer;
  }

  async updateEngineSettings(command: EngineSettingsCommandDTO, updatedBy: string): Promise<EngineSettingsUpdateResultDTO> {
    await this.validator.validate(engineSchema, command);

    if (command.webServer.port === command.proxyServer.port) {
      throw new Error('Web server port and proxy port can not be the same');
    }

    const oldEngineSettings = this.getEngineSettings();

    if (!command.logger.loki.password) {
      command.logger.loki.password = oldEngineSettings.logger.loki.password;
    } else {
      command.logger.loki.password = encryptionService.encryptText(command.logger.loki.password);
    }
    if (command.proxyServer.forward) {
      if (!command.proxyServer.forward.password) {
        command.proxyServer.forward.password = oldEngineSettings.proxyServer.forward.password;
      } else {
        command.proxyServer.forward.password = await encryptionService.encryptText(command.proxyServer.forward.password);
      }
    }
    if (!command.proxyServer.password) {
      command.proxyServer.password = oldEngineSettings.proxyServer.password;
    } else {
      command.proxyServer.password = await argon2.hash(command.proxyServer.password);
    }
    this.engineRepository.update(command, updatedBy);
    const settings = this.getEngineSettings();

    if (
      JSON.stringify(oldEngineSettings.logger) !== JSON.stringify(settings.logger) ||
      oldEngineSettings.general.name !== settings.general.name
    ) {
      await this.resetLogger(settings);
    }

    const portChanged = command.webServer.port !== oldEngineSettings.webServer.port;
    if (portChanged) {
      // Emit the port change event asynchronously to ensure the HTTP response is sent first
      setImmediate(() => {
        this.portChangeEvent.emit('updated', settings.webServer.port);
      });
    }
    this.proxyServer.stop();
    this.proxyServer.start(settings.proxyServer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    return {
      needsRedirect: portChanged,
      newPort: portChanged ? settings.webServer.port : null
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
    if (command.port === oldEngineSettings.proxyServer.port) {
      throw new Error('Web server port and proxy port can not be the same');
    }
    this.engineRepository.updateWebServer(command, updatedBy);
    const settings = this.getEngineSettings();
    const portChanged = command.port !== oldEngineSettings.webServer.port;
    if (portChanged) {
      setImmediate(() => {
        this.portChangeEvent.emit('updated', settings.webServer.port);
      });
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return {
      needsRedirect: portChanged,
      newPort: portChanged ? settings.webServer.port : null
    };
  }

  async updateEngineProxy(command: EngineProxyCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineProxySchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (command.enabled && command.port === oldEngineSettings.webServer.port) {
      throw new Error('Web server port and proxy port can not be the same');
    }
    if (command.forward) {
      if (!command.forward.password) {
        command.forward.password = oldEngineSettings.proxyServer.forward.password;
      } else {
        command.forward.password = encryptionService.encryptText(command.forward.password);
      }
    }
    if (!command.password) {
      command.password = oldEngineSettings.proxyServer.password;
    } else {
      command.password = await argon2.hash(command.password);
    }
    this.engineRepository.updateProxy(command, updatedBy);
    const settings = this.getEngineSettings();
    this.proxyServer.stop();
    this.proxyServer.start(settings.proxyServer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async updateEngineLogger(command: EngineLoggerCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineLoggerSchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (!command.loki.password) {
      command.loki.password = oldEngineSettings.logger.loki.password;
    } else {
      command.loki.password = encryptionService.encryptText(command.loki.password);
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
    version: engineSettings.version,
    launcherVersion: engineSettings.launcherVersion,
    auditRetentionDuration: engineSettings.auditRetentionDuration,
    general: {
      name: engineSettings.general.name
    },
    webServer: {
      port: engineSettings.webServer.port,
      authTokenDuration: engineSettings.webServer.authTokenDuration
    },
    proxyServer: {
      enabled: engineSettings.proxyServer.enabled,
      port: engineSettings.proxyServer.port,
      forward: {
        enabled: engineSettings.proxyServer.forward.enabled,
        url: engineSettings.proxyServer.forward.url,
        username: engineSettings.proxyServer.forward.username,
        password: ''
      },
      username: engineSettings.proxyServer.username,
      password: ''
    },
    logger: {
      console: {
        level: engineSettings.logger.console.level
      },
      file: {
        level: engineSettings.logger.file.level,
        maxFileSize: engineSettings.logger.file.maxFileSize,
        numberOfFiles: engineSettings.logger.file.numberOfFiles
      },
      database: {
        level: engineSettings.logger.database.level,
        maxNumberOfLogs: engineSettings.logger.database.maxNumberOfLogs
      },

      loki: {
        level: engineSettings.logger.loki.level,
        interval: engineSettings.logger.loki.interval,
        address: engineSettings.logger.loki.address,
        username: engineSettings.logger.loki.username,
        password: ''
      },
      oia: {
        level: engineSettings.logger.oia.level,
        interval: engineSettings.logger.oia.interval
      },
      syslog: {
        level: engineSettings.logger.syslog.level,
        host: engineSettings.logger.syslog.host,
        port: engineSettings.logger.syslog.port,
        protocol: engineSettings.logger.syslog.protocol
      }
    }
  };
};
