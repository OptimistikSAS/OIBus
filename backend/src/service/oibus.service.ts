import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import v8 from 'node:v8';

import argon2 from 'argon2';
import { DateTime } from 'luxon';

import {
  EngineLoggerCommandDTO,
  EngineMemoryDumpDTO,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  EngineSettingsUpdateResultDTO,
  EngineWebServerCommandDTO,
  HomeMetrics,
  OIBusInfo
} from '../../shared/model/api/engine.model';
import { OIBusContent } from '../../shared/model/common/content.model';
import { GetUserInfo } from '../../shared/model/common/types';
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  EngineMetrics,
  FileCacheContent,
  WebServerHttpsSettings
} from '../../shared/model/domain/engine.model';

import DataStreamEngine from '../engine/data-stream-engine';
import { EngineSettings } from '../model/engine.model';
import type { ILogger } from '../model/logger.model';
import { OIBusValidationError } from '../model/types';
import CertificateRepository from '../repository/config/certificate.repository';
import EngineRepository from '../repository/config/engine.repository';
import EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import {
  engineLoggerSchema,
  engineNameSchema,
  engineProxySchema,
  engineSchema,
  engineWebServerSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import ProxyServer from '../web-server/proxy-server';
import { encryptionService } from './encryption.service';
import { toEngineLoggerCommand, toEngineProxyCommand, toEngineSettingsCommand, toEngineWebServerCommand } from './engine-command.utils';
import HistoryQueryService from './history-query.service';
import IPFilterService from './ip-filter.service';
import LoggerService from './logger/logger.service';
import NorthService from './north.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsRegistrationService from './oia/oianalytics-registration.service';
import SouthService from './south.service';
import UserService from './user.service';
import { getOIBusInfo } from './utils';
import { assertTlsCredentials } from './utils-certificate';
const HEALTH_SIGNAL_INTERVAL = 1_800_000; // 30 minutes
const UPDATE_ENGINE_METRICS_INTERVAL = 1000; // every second

export default class OIBusService {
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
  public webServerChangeEvent: EventEmitter = new EventEmitter(); // Used to restart the Web server when its port or HTTPS settings change

  constructor(
    protected readonly validator: JoiValidator,
    private engineRepository: EngineRepository,
    private engineMetricsRepository: EngineMetricsRepository,
    private certificateRepository: CertificateRepository,
    private ipFilterService: IPFilterService,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private loggerService: LoggerService,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
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
    this.metrics = { ...this.engineMetricsRepository.getMetrics(settings.id)!, metricsStart: DateTime.now().toUTC().toISO()! };
    this.engineMetricsRepository.updateMetrics(settings.id, this.metrics);
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
    const engineCommand = toEngineSettingsCommand(
      command,
      {
        proxyPassword: await hashedOrCurrent(command.proxyServer.password, oldEngineSettings.proxyServer.password),
        forwardProxyPassword: encryptedOrCurrent(command.proxyServer.forward?.password, oldEngineSettings.proxyServer.forward.password),
        lokiPassword: encryptedOrCurrent(command.logger.loki.password, oldEngineSettings.logger.loki.password)
      },
      oldEngineSettings.webServer
    );
    await this.assertWebServerCanStart(oldEngineSettings.webServer, engineCommand.webServer);

    this.engineRepository.update(engineCommand, updatedBy);
    const settings = this.getEngineSettings();

    if (
      JSON.stringify(oldEngineSettings.logger) !== JSON.stringify(settings.logger) ||
      oldEngineSettings.general.name !== settings.general.name
    ) {
      await this.resetLogger(settings);
    }

    const result = this.restartWebServerIfChanged(oldEngineSettings.webServer, settings.webServer);
    this.proxyServer.stop();
    this.proxyServer.start(settings.proxyServer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    return result;
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
    const webServerCommand = toEngineWebServerCommand(command, oldEngineSettings.webServer);
    await this.assertWebServerCanStart(oldEngineSettings.webServer, webServerCommand);
    this.engineRepository.updateWebServer(webServerCommand, updatedBy);
    const result = this.restartWebServerIfChanged(oldEngineSettings.webServer, this.getEngineSettings().webServer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return result;
  }

  /**
   * The certificate (followed by its CA chain) and private key the web server serves HTTPS with, read from the certificate
   * store or from PEM files (a relative path is resolved from the data folder, the working directory of OIBus). Throws an
   * OIBusValidationError when they can't be read or don't match.
   */
  async getWebServerCredentials(https: WebServerHttpsSettings): Promise<{ cert: string; key: string }> {
    let cert: string;
    let key: string;
    if (https.certificateSource === 'store') {
      const certificate = https.certificateId ? this.certificateRepository.findById(https.certificateId) : null;
      if (!certificate) {
        throw new OIBusValidationError(`Certificate "${https.certificateId}" not found`);
      }
      if (!certificate.privateKey) {
        throw new OIBusValidationError(`Certificate "${certificate.name}" has no private key`);
      }
      cert = [certificate.certificate, certificate.certificateChain].filter(Boolean).join('\n');
      key = await encryptionService.decryptText(certificate.privateKey);
    } else {
      cert = await readPemFile(https.certificatePath, 'certificate');
      key = await readPemFile(https.privateKeyPath, 'private key');
    }
    assertTlsCredentials(cert, key);
    return { cert, key };
  }

  /**
   * When the web server is about to restart with HTTPS, checks that its certificate can be loaded: the settings are
   * rejected rather than leaving the web server unable to serve HTTPS (it then falls back to HTTP).
   */
  private async assertWebServerCanStart(previous: EngineSettings['webServer'], next: EngineSettings['webServer']): Promise<void> {
    if (next.https.enabled && webServerChanged(previous, next)) {
      await this.getWebServerCredentials(next.https);
    }
  }

  /**
   * Restarts the web server when its port or HTTPS settings changed: the event is emitted asynchronously to ensure the HTTP
   * response is sent first. The client must then be redirected when the port or protocol it reaches OIBus with changed.
   */
  private restartWebServerIfChanged(
    previous: EngineSettings['webServer'],
    next: EngineSettings['webServer']
  ): EngineSettingsUpdateResultDTO {
    if (!webServerChanged(previous, next)) {
      return { needsRedirect: false, newPort: null, newProtocol: null };
    }
    setImmediate(() => {
      this.webServerChangeEvent.emit('updated', next);
    });
    const needsRedirect = previous.port !== next.port || previous.https.enabled !== next.https.enabled;
    return {
      needsRedirect,
      newPort: needsRedirect ? next.port : null,
      newProtocol: needsRedirect ? (next.https.enabled ? 'https' : 'http') : null
    };
  }

  async updateEngineProxy(command: EngineProxyCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineProxySchema, command);
    const oldEngineSettings = this.getEngineSettings();
    if (command.enabled && command.port === oldEngineSettings.webServer.port) {
      throw new Error('Web server port and proxy port can not be the same');
    }
    this.engineRepository.updateProxy(
      toEngineProxyCommand(command, {
        proxyPassword: await hashedOrCurrent(command.password, oldEngineSettings.proxyServer.password),
        forwardProxyPassword: encryptedOrCurrent(command.forward?.password, oldEngineSettings.proxyServer.forward.password)
      }),
      updatedBy
    );
    const settings = this.getEngineSettings();
    this.proxyServer.stop();
    this.proxyServer.start(settings.proxyServer);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async updateEngineLogger(command: EngineLoggerCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(engineLoggerSchema, command);
    const oldEngineSettings = this.getEngineSettings();
    this.engineRepository.updateLogger(
      toEngineLoggerCommand(command, { lokiPassword: encryptedOrCurrent(command.loki.password, oldEngineSettings.logger.loki.password) }),
      updatedBy
    );
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

  /**
   * Write a V8 heap snapshot at the root of the data folder (the process working directory).
   * The snapshot is synchronous: the whole process (and therefore every data flow) is blocked until the file is written,
   * and it may temporarily require as much memory as the current heap size.
   */
  dumpMemory(): EngineMemoryDumpDTO {
    const filename = `oibus-memory-dump-${DateTime.now().toUTC().toFormat('yyyy-MM-dd_HH-mm-ss')}.heapsnapshot`;
    const filePath = path.resolve(process.cwd(), filename);
    this.logger.warn(`Writing memory dump to "${filePath}". Data flows are paused until the dump completes`);
    const start = DateTime.now().toMillis();
    v8.writeHeapSnapshot(filePath);
    this.logger.info(`Memory dump "${filename}" written in ${DateTime.now().toMillis() - start} ms`);
    return { filename };
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
    this.webServerChangeEvent.removeAllListeners();
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

  /** Current engine metrics, refreshed every second by `updateEngineMetrics`. */
  getEngineMetrics(): EngineMetrics {
    return this.metrics;
  }

  /** Metrics shown on the home page: the engine plus every north and south connector. */
  getHomeMetrics(): HomeMetrics {
    return {
      norths: this.engine.getAllNorthMetrics(),
      engine: this.metrics,
      souths: this.engine.getAllSouthMetrics()
    };
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
      authTokenDuration: engineSettings.webServer.authTokenDuration,
      https: { ...engineSettings.webServer.https },
      enableContentEndpoint: engineSettings.webServer.enableContentEndpoint
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

/** Whether the web server must restart: the authentication token duration is read at each sign in. */
const webServerChanged = (previous: EngineSettings['webServer'], next: EngineSettings['webServer']): boolean =>
  previous.port !== next.port || JSON.stringify(previous.https) !== JSON.stringify(next.https);

const readPemFile = async (filePath: string | null, description: string): Promise<string> => {
  try {
    return await fs.readFile(path.resolve(filePath!), 'utf8');
  } catch (error: unknown) {
    throw new OIBusValidationError(`Unable to read the ${description} file "${filePath}": ${(error as Error).message}`);
  }
};

/** An empty secret in an API command keeps the current one; a new one is encrypted. */
const encryptedOrCurrent = (secret: string | null | undefined, current: string | null): string | null =>
  secret ? encryptionService.encryptText(secret) : current;

/** Same for the proxy server password, which is hashed instead: it is only ever checked, never sent. */
const hashedOrCurrent = async (secret: string | null | undefined, current: string | null): Promise<string | null> =>
  secret ? await argon2.hash(secret) : current;
