import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments, getOIBusInfo } from './service/utils';
import RepositoryService from './service/repository.service';
import ReloadService from './service/reload.service';
import NorthService from './service/north.service';
import SouthService from './service/south.service';
import OIBusEngine from './engine/oibus-engine';
import HistoryQueryEngine from './engine/history-query-engine';
import HistoryQueryService from './service/history-query.service';
import OIBusService from './service/oibus.service';
import { migrateCrypto, migrateEntities, migrateLogsAndMetrics, migrateSouthCache } from './db/migration-service';
import OIAnalyticsCommandService from './service/oia/oianalytics-command.service';
import OianalyticsRegistrationService from './service/oia/oianalytics-registration.service';
import ConnectionService from './service/connection.service';
import OIAnalyticsMessageService from './service/oia/oianalytics-message.service';
import SouthConnectorConfigService from './service/south-connector-config.service';
import JoiValidator from './web-server/controllers/validators/joi.validator';
import ScanModeService from './service/scan-mode.service';
import NorthConnectorConfigService from './service/north-connector-config.service';
import SubscriptionService from './service/subscription.service';
import IPFilterService from './service/ip-filter.service';

const CONFIG_DATABASE = 'oibus.db';
const CRYPTO_DATABASE = 'crypto.db';
const CACHE_FOLDER = './cache';
const CACHE_DATABASE = 'cache.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'logs.db';

(async () => {
  const { configFile, check } = getCommandLineArguments();

  const binaryFolder = process.cwd();

  const baseDir = path.resolve(configFile);
  console.info(`Starting OIBus with base directory ${baseDir}...`);
  process.chdir(baseDir);

  // Create the base cache folder
  await createFolder(CACHE_FOLDER);
  await createFolder(LOG_FOLDER_NAME);

  // run migrations
  await migrateEntities(path.resolve(CONFIG_DATABASE));
  await migrateLogsAndMetrics(path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME));
  await migrateCrypto(path.resolve(CRYPTO_DATABASE));
  await migrateSouthCache(path.resolve(CACHE_FOLDER, CACHE_DATABASE));

  const repositoryService = new RepositoryService(
    path.resolve(CONFIG_DATABASE),
    path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME),
    path.resolve(CRYPTO_DATABASE),
    path.resolve(CACHE_FOLDER, CACHE_DATABASE)
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

  const connectionService = new ConnectionService(loggerService.logger!);
  const northService = new NorthService(encryptionService, repositoryService);
  const southService = new SouthService(encryptionService, repositoryService, connectionService);
  const historyQueryService = new HistoryQueryService(repositoryService);

  const engine = new OIBusEngine(encryptionService, northService, southService, loggerService.logger!);
  const historyQueryEngine = new HistoryQueryEngine(
    encryptionService,
    northService,
    southService,
    historyQueryService,
    loggerService.logger!
  );

  const oIAnalyticsMessageService = new OIAnalyticsMessageService(repositoryService, encryptionService, loggerService.logger!);

  const oIBusService = new OIBusService(
    new JoiValidator(),
    repositoryService.engineRepository,
    repositoryService.engineMetricsRepository,
    repositoryService.ipFilterRepository,
    repositoryService.oianalyticsRegistrationRepository,
    encryptionService,
    loggerService,
    oIAnalyticsMessageService,
    engine,
    historyQueryEngine
  );

  await oIBusService.startOIBus();

  const reloadService = new ReloadService(
    loggerService,
    repositoryService,
    northService,
    southService,
    engine,
    historyQueryEngine,
    oIBusService,
    oIAnalyticsMessageService,
    oIBusService.getProxyServer()
  );

  const scanModeService = new ScanModeService(
    new JoiValidator(),
    repositoryService.scanModeRepository,
    repositoryService.southCacheRepository,
    oIAnalyticsMessageService,
    engine
  );
  const subscriptionService = new SubscriptionService(
    new JoiValidator(),
    repositoryService.subscriptionRepository,
    repositoryService.southConnectorRepository,
    repositoryService.northConnectorRepository,
    oIAnalyticsMessageService,
    engine
  );
  const ipFilterService = new IPFilterService(
    new JoiValidator(),
    repositoryService.ipFilterRepository,
    oIAnalyticsMessageService,
    oIBusService.getProxyServer()
  );

  const southConnectorConfigService = new SouthConnectorConfigService(
    new JoiValidator(),
    repositoryService.southConnectorRepository,
    repositoryService.southItemRepository,
    repositoryService.scanModeRepository,
    southService,
    reloadService,
    oIAnalyticsMessageService,
    encryptionService
  );

  const northConnectorConfigService = new NorthConnectorConfigService(
    new JoiValidator(),
    repositoryService.northConnectorRepository,
    repositoryService.subscriptionRepository,
    repositoryService.scanModeRepository,
    northService,
    reloadService,
    oIAnalyticsMessageService,
    encryptionService
  );

  const oIAnalyticsCommandService = new OIAnalyticsCommandService(
    repositoryService.oianalyticsCommandRepository,
    repositoryService.oianalyticsRegistrationRepository,
    encryptionService,
    oIBusService,
    scanModeService,
    southConnectorConfigService,
    northConnectorConfigService,
    loggerService.logger!,
    binaryFolder
  );
  oIAnalyticsCommandService.start();
  oIAnalyticsMessageService.start(); // Start after command to send the full config with new version after an update

  const oIAnalyticsRegistrationService = new OianalyticsRegistrationService(
    new JoiValidator(),
    repositoryService.oianalyticsRegistrationRepository,
    repositoryService.engineRepository,
    encryptionService,
    loggerService.logger!
  );
  oIAnalyticsRegistrationService.start();
  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    scanModeService,
    subscriptionService,
    ipFilterService,
    oIAnalyticsRegistrationService,
    oIAnalyticsCommandService,
    oIBusService,
    reloadService,
    repositoryService,
    southService,
    northService,
    southConnectorConfigService,
    northConnectorConfigService,
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
