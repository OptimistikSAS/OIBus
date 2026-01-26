import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import { encryptionService } from './service/encryption.service';

import { createFolder, getCommandLineArguments, getOIBusInfo } from './service/utils';
import RepositoryService from './service/repository.service';
import NorthService from './service/north.service';
import SouthService from './service/south.service';
import DataStreamEngine from './engine/data-stream-engine';
import HistoryQueryService from './service/history-query.service';
import OIBusService from './service/oibus.service';
import {
  migrateCrypto,
  migrateDataFolder,
  migrateEntities,
  migrateLogs,
  migrateMetrics,
  migrateSouthCache
} from './migration/migration-service';
import OIAnalyticsCommandService from './service/oia/oianalytics-command.service';
import OianalyticsRegistrationService from './service/oia/oianalytics-registration.service';
import OIAnalyticsMessageService from './service/oia/oianalytics-message.service';
import JoiValidator from './web-server/controllers/validators/joi.validator';
import ScanModeService from './service/scan-mode.service';
import IPFilterService from './service/ip-filter.service';
import HomeMetricsService from './service/metrics/home-metrics.service';
import OIAnalyticsClient from './service/oia/oianalytics-client.service';
import CertificateService from './service/certificate.service';
import UserService from './service/user.service';
import LogService from './service/log.service';
import CleanupService from './service/cache/cleanup.service';
import TransformerService from './service/transformer.service';

const CONFIG_DATABASE = 'oibus.db';
const CRYPTO_DATABASE = 'crypto.db';
const CACHE_FOLDER = './cache';
const CACHE_DATABASE = 'cache.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'logs.db';
const METRICS_DB_NAME = 'metrics.db';
const CERT_FOLDER = 'certs';

(async () => {
  const { configFile, version, ignoreIpFilters, ignoreRemoteUpdate, launcherVersion } = getCommandLineArguments();

  const binaryFolder = process.cwd();

  const baseDir = path.resolve(configFile);
  console.info(
    `Starting OIBus with launcherVersion = ${launcherVersion}, ignoreIpFilters = ${ignoreIpFilters}, ignoreRemoteUpdate = ${ignoreRemoteUpdate} and data folder directory ${baseDir}...`
  );
  process.chdir(baseDir);

  // Create the base cache folder
  await createFolder(CACHE_FOLDER);
  await createFolder(LOG_FOLDER_NAME);

  // run migrations
  await migrateDataFolder(path.resolve(CONFIG_DATABASE));
  await migrateEntities(path.resolve(CONFIG_DATABASE));
  await migrateLogs(path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME));
  await migrateMetrics(path.resolve(LOG_FOLDER_NAME, METRICS_DB_NAME));
  await migrateCrypto(path.resolve(CRYPTO_DATABASE));
  await migrateSouthCache(path.resolve(CACHE_FOLDER, CACHE_DATABASE));

  const repositoryService = new RepositoryService(
    path.resolve(CONFIG_DATABASE),
    path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME),
    path.resolve(LOG_FOLDER_NAME, METRICS_DB_NAME),
    path.resolve(CRYPTO_DATABASE),
    path.resolve(CACHE_FOLDER, CACHE_DATABASE),
    launcherVersion
  );

  const oibusSettings = repositoryService.engineRepository.get();
  if (!oibusSettings) {
    console.error('Error while loading OIBus settings from database');
    return;
  }
  console.info(`OIBus settings loaded. OIBus ID: ${oibusSettings.id} ; OIBus name : ${oibusSettings.name}.`);

  if (!repositoryService.cryptoRepository.getCryptoSettings(oibusSettings.id)) {
    repositoryService.cryptoRepository.createCryptoSettings(oibusSettings.id);
  }
  const cryptoSettings = repositoryService.cryptoRepository.getCryptoSettings(oibusSettings.id);
  if (!cryptoSettings) {
    console.error('Error while loading OIBus crypto settings from database');
    return;
  }
  await encryptionService.init(cryptoSettings, path.resolve(CERT_FOLDER));

  if (version) {
    console.info(`OIBus version: ${oibusSettings.version}`);
    console.info(`Launcher version: ${launcherVersion}`);
    process.exit(0);
  }

  await createFolder(LOG_FOLDER_NAME);
  const loggerService = new LoggerService(path.resolve(LOG_FOLDER_NAME));
  await loggerService.start(oibusSettings, repositoryService.oianalyticsRegistrationRepository.get()!);

  const oIAnalyticsClient = new OIAnalyticsClient();

  const oIAnalyticsRegistrationService = new OianalyticsRegistrationService(
    new JoiValidator(),
    oIAnalyticsClient,
    repositoryService.oianalyticsRegistrationRepository,
    repositoryService.engineRepository,
    loggerService.logger!
  );
  oIAnalyticsRegistrationService.start();

  const oIAnalyticsMessageService = new OIAnalyticsMessageService(
    repositoryService.oianalyticsMessageRepository,
    oIAnalyticsRegistrationService,
    repositoryService.engineRepository,
    repositoryService.scanModeRepository,
    repositoryService.ipFilterRepository,
    repositoryService.certificateRepository,
    repositoryService.userRepository,
    repositoryService.southConnectorRepository,
    repositoryService.northConnectorRepository,
    repositoryService.historyQueryRepository,
    repositoryService.transformerRepository,
    oIAnalyticsClient,
    loggerService.logger!
  );

  const dataStreamEngine = new DataStreamEngine(
    repositoryService.northConnectorRepository,
    repositoryService.northMetricsRepository,
    repositoryService.southConnectorRepository,
    repositoryService.southMetricsRepository,
    repositoryService.historyQueryRepository,
    repositoryService.historyQueryMetricsRepository,
    repositoryService.southCacheRepository,
    repositoryService.certificateRepository,
    repositoryService.oianalyticsRegistrationRepository,
    oIAnalyticsMessageService,
    loggerService.logger!
  );

  const transformerService = new TransformerService(new JoiValidator(), repositoryService.transformerRepository, oIAnalyticsMessageService);

  const northService = new NorthService(
    new JoiValidator(),
    repositoryService.northConnectorRepository,
    repositoryService.southConnectorRepository,
    repositoryService.northMetricsRepository,
    repositoryService.scanModeRepository,
    repositoryService.logRepository,
    repositoryService.certificateRepository,
    repositoryService.oianalyticsRegistrationRepository,
    oIAnalyticsMessageService,
    transformerService,
    dataStreamEngine
  );
  const southService = new SouthService(
    new JoiValidator(),
    repositoryService.southConnectorRepository,
    repositoryService.logRepository,
    repositoryService.southMetricsRepository,
    repositoryService.southCacheRepository,
    repositoryService.scanModeRepository,
    repositoryService.oianalyticsRegistrationRepository,
    repositoryService.certificateRepository,
    oIAnalyticsMessageService,
    dataStreamEngine,
    repositoryService.southItemGroupRepository
  );
  const historyQueryService = new HistoryQueryService(
    new JoiValidator(),
    repositoryService.historyQueryRepository,
    repositoryService.northConnectorRepository,
    repositoryService.southConnectorRepository,
    repositoryService.scanModeRepository,
    repositoryService.logRepository,
    repositoryService.historyQueryMetricsRepository,
    southService,
    northService,
    transformerService,
    oIAnalyticsMessageService,
    dataStreamEngine
  );

  const ipFilterService = new IPFilterService(new JoiValidator(), repositoryService.ipFilterRepository, oIAnalyticsMessageService);
  const oIBusService = new OIBusService(
    new JoiValidator(),
    repositoryService.engineRepository,
    repositoryService.engineMetricsRepository,
    ipFilterService,
    oIAnalyticsRegistrationService,
    loggerService,
    oIAnalyticsMessageService,
    southService,
    northService,
    historyQueryService,
    dataStreamEngine,
    ignoreIpFilters
  );
  await oIBusService.start();

  const homeMetricsService = new HomeMetricsService(oIBusService, dataStreamEngine);

  const scanModeService = new ScanModeService(
    new JoiValidator(),
    repositoryService.scanModeRepository,
    repositoryService.southCacheRepository,
    oIAnalyticsMessageService,
    dataStreamEngine
  );
  const certificateService = new CertificateService(
    new JoiValidator(),
    repositoryService.certificateRepository,
    encryptionService,
    oIAnalyticsMessageService
  );
  const userService = new UserService(new JoiValidator(), repositoryService.userRepository);
  const logService = new LogService(new JoiValidator(), repositoryService.logRepository);

  const oIAnalyticsCommandService = new OIAnalyticsCommandService(
    repositoryService.oianalyticsCommandRepository,
    oIAnalyticsRegistrationService,
    oIAnalyticsMessageService,
    oIAnalyticsClient,
    oIBusService,
    scanModeService,
    ipFilterService,
    certificateService,
    southService,
    northService,
    historyQueryService,
    loggerService.logger!,
    binaryFolder,
    ignoreRemoteUpdate,
    launcherVersion
  );
  await oIAnalyticsCommandService.start();
  oIAnalyticsMessageService.start(); // Start after command to send the full config with a new version after an update

  const cleanupService = new CleanupService(
    loggerService.logger!,
    './',
    repositoryService.historyQueryRepository,
    repositoryService.northConnectorRepository,
    repositoryService.southConnectorRepository,
    repositoryService.oianalyticsMessageRepository,
    repositoryService.oianalyticsCommandRepository,
    dataStreamEngine
  );
  await cleanupService.start();

  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    scanModeService,
    ipFilterService,
    certificateService,
    logService,
    userService,
    oIAnalyticsRegistrationService,
    oIAnalyticsCommandService,
    oIBusService,
    southService,
    northService,
    transformerService,
    historyQueryService,
    homeMetricsService,
    ignoreIpFilters,
    loggerService.createChildLogger('web-server')
  );
  await server.init();

  let stopping = false;
  // Catch Ctrl+C and properly stop the Engine
  process.on('SIGINT', async () => {
    if (stopping) return;
    console.info('SIGINT (Ctrl+C) received. Stopping everything.');
    stopping = true;
    await oIBusService.stop();
    await oIAnalyticsCommandService.stop();
    await oIAnalyticsMessageService.stop();
    await server.stop();
    await cleanupService.stop();
    oIAnalyticsRegistrationService.stop();
    loggerService.stop();
    console.info('OIBus stopped');
    stopping = false;
    process.exit();
  });

  const updatedOIBusSettings = repositoryService.engineRepository.get()!;
  loggerService.logger!.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(updatedOIBusSettings))}`);
  console.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(updatedOIBusSettings))}`);
})();
