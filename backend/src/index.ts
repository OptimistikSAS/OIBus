import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments, getOIBusInfo } from './service/utils';
import RepositoryService from './service/repository.service';
import NorthService from './service/north.service';
import SouthService from './service/south.service';
import DataStreamEngine from './engine/data-stream-engine';
import HistoryQueryEngine from './engine/history-query-engine';
import HistoryQueryService from './service/history-query.service';
import OIBusService from './service/oibus.service';
import { migrateCrypto, migrateEntities, migrateDataFolder, migrateLogsAndMetrics, migrateSouthCache } from './migration/migration-service';
import OIAnalyticsCommandService from './service/oia/oianalytics-command.service';
import OianalyticsRegistrationService from './service/oia/oianalytics-registration.service';
import ConnectionService from './service/connection.service';
import OIAnalyticsMessageService from './service/oia/oianalytics-message.service';
import JoiValidator from './web-server/controllers/validators/joi.validator';
import ScanModeService from './service/scan-mode.service';
import IPFilterService from './service/ip-filter.service';
import HomeMetricsService from './service/metrics/home-metrics.service';
import OIAnalyticsClient from './service/oia/oianalytics-client.service';
import CertificateService from './service/certificate.service';
import UserService from './service/user.service';
import LogService from './service/log.service';

const CONFIG_DATABASE = 'oibus.db';
const CRYPTO_DATABASE = 'crypto.db';
const CACHE_FOLDER = './cache';
const CACHE_DATABASE = 'cache.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'logs.db';

(async () => {
  const { configFile, check, ignoreIpFilters, ignoreRemoteUpdate, launcherVersion } = getCommandLineArguments();

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
  await migrateLogsAndMetrics(path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME));
  await migrateCrypto(path.resolve(CRYPTO_DATABASE));
  await migrateSouthCache(path.resolve(CACHE_FOLDER, CACHE_DATABASE));

  const repositoryService = new RepositoryService(
    path.resolve(CONFIG_DATABASE),
    path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME),
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

  const encryptionService = new EncryptionService(cryptoSettings);
  await encryptionService.init();

  if (check) {
    console.info('OIBus started in check mode. Exiting process.');
    process.exit();
  }

  await createFolder(LOG_FOLDER_NAME);
  const loggerService = new LoggerService(encryptionService, path.resolve(LOG_FOLDER_NAME));
  await loggerService.start(oibusSettings, repositoryService.oianalyticsRegistrationRepository.get()!);

  const dataStreamEngine = new DataStreamEngine(
    repositoryService.northMetricsRepository,
    repositoryService.southMetricsRepository,
    loggerService.logger!
  );
  const historyQueryEngine = new HistoryQueryEngine(repositoryService.historyQueryMetricsRepository, loggerService.logger!);

  const oIAnalyticsClient = new OIAnalyticsClient(encryptionService);

  const oIAnalyticsRegistrationService = new OianalyticsRegistrationService(
    new JoiValidator(),
    oIAnalyticsClient,
    repositoryService.oianalyticsRegistrationRepository,
    repositoryService.engineRepository,
    encryptionService,
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
    oIAnalyticsClient,
    encryptionService,
    loggerService.logger!
  );

  const connectionService = new ConnectionService(loggerService.logger!);
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
    encryptionService,
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
    encryptionService,
    connectionService,
    dataStreamEngine
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
    oIAnalyticsMessageService,
    encryptionService,
    historyQueryEngine
  );

  const oIBusService = new OIBusService(
    new JoiValidator(),
    repositoryService.engineRepository,
    repositoryService.engineMetricsRepository,
    repositoryService.ipFilterRepository,
    oIAnalyticsRegistrationService,
    encryptionService,
    loggerService,
    oIAnalyticsMessageService,
    southService,
    northService,
    historyQueryService,
    dataStreamEngine,
    historyQueryEngine,
    ignoreIpFilters
  );
  await oIBusService.startOIBus();

  const homeMetricsService = new HomeMetricsService(oIBusService, dataStreamEngine);

  const scanModeService = new ScanModeService(
    new JoiValidator(),
    repositoryService.scanModeRepository,
    repositoryService.southCacheRepository,
    oIAnalyticsMessageService,
    dataStreamEngine
  );
  const ipFilterService = new IPFilterService(
    new JoiValidator(),
    repositoryService.ipFilterRepository,
    oIAnalyticsMessageService,
    oIBusService.getProxyServer()
  );
  const certificateService = new CertificateService(new JoiValidator(), repositoryService.certificateRepository, encryptionService);
  const userService = new UserService(new JoiValidator(), repositoryService.userRepository);
  const logService = new LogService(new JoiValidator(), repositoryService.logRepository);

  const oIAnalyticsCommandService = new OIAnalyticsCommandService(
    repositoryService.oianalyticsCommandRepository,
    oIAnalyticsRegistrationService,
    oIAnalyticsMessageService,
    encryptionService,
    oIAnalyticsClient,
    oIBusService,
    scanModeService,
    southService,
    northService,
    loggerService.logger!,
    binaryFolder,
    ignoreRemoteUpdate,
    launcherVersion
  );
  await oIAnalyticsCommandService.start();
  oIAnalyticsMessageService.start(); // Start after command to send the full config with new version after an update

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
    await oIBusService.stopOIBus();
    await oIAnalyticsCommandService.stop();
    await oIAnalyticsMessageService.stop();
    await server.stop();
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
