import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments, getOIBusInfo } from './service/utils';
import RepositoryService from './service/repository.service';
import ReloadService from './service/reload.service';
import EngineMetricsService from './service/engine-metrics.service';
import NorthService from './service/north.service';
import SouthService from './service/south.service';
import OIBusEngine from './engine/oibus-engine';
import HistoryQueryEngine from './engine/history-query-engine';
import HistoryQueryService from './service/history-query.service';
import OIBusService from './service/oibus.service';
import { migrateCrypto, migrateEntities, migrateLogsAndMetrics, migrateSouthCache } from './db/migration-service';
import HomeMetricsService from './service/home-metrics.service';
import OianalyticsCommandService from './service/oia/oianalytics-command.service';
import OianalyticsRegistrationService from './service/oia/oianalytics-registration.service';
import ProxyServer from './web-server/proxy-server';
import ConnectionService from './service/connection.service';
import OIAnalyticsMessageService from './service/oia/oianalytics-message.service';
import OIAnalyticsConfigurationClient from './service/oia/oianalytics-configuration.client';
import SouthConnectorConfigService from './service/south-connector-config.service';
import JoiValidator from './web-server/controllers/validators/joi.validator';
import OIAnalyticsCommandClient from './service/oia/oianalytics-command.client';
import ScanModeService from './service/scan-mode.service';
import NorthConnectorConfigService from './service/north-connector-config.service';

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
  await loggerService.start(
    oibusSettings.id,
    oibusSettings.name,
    oibusSettings.logParameters,
    repositoryService.oianalyticsRegistrationRepository.get()
  );

  const connectionService = new ConnectionService(loggerService.logger!);
  const northService = new NorthService(encryptionService, repositoryService);
  const southService = new SouthService(encryptionService, repositoryService, connectionService);
  const historyQueryService = new HistoryQueryService(repositoryService);

  const engineMetricsService = new EngineMetricsService(loggerService.logger!, oibusSettings.id, repositoryService.engineMetricsRepository);
  const homeMetricsService = new HomeMetricsService(
    oibusSettings.id,
    engineMetricsService,
    repositoryService.engineMetricsRepository,
    repositoryService.northMetricsRepository,
    repositoryService.southMetricsRepository
  );

  const engine = new OIBusEngine(encryptionService, northService, southService, homeMetricsService, loggerService.logger!);
  const historyQueryEngine = new HistoryQueryEngine(
    encryptionService,
    northService,
    southService,
    historyQueryService,
    loggerService.logger!
  );

  const configurationClient = new OIAnalyticsConfigurationClient(
    repositoryService.oianalyticsRegistrationRepository,
    encryptionService,
    loggerService.logger!
  );

  const commandClient = new OIAnalyticsCommandClient(
    repositoryService.oianalyticsRegistrationRepository,
    encryptionService,
    loggerService.logger!
  );

  const oianalyticsMessageService = new OIAnalyticsMessageService(repositoryService, configurationClient, loggerService.logger!);
  oianalyticsMessageService.start();

  const oibusService = new OIBusService(engine, historyQueryEngine);

  await engine.start();
  await historyQueryEngine.start();

  const proxyServer = new ProxyServer(loggerService.logger!);
  const ipFilters = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    ...repositoryService.ipFilterRepository.findAll().map(filter => filter.address)
  ];
  proxyServer.refreshIpFilters(ipFilters);

  if (oibusSettings.proxyEnabled) {
    await proxyServer.start(oibusSettings.proxyPort!);
  }

  const reloadService = new ReloadService(
    loggerService,
    repositoryService,
    engineMetricsService,
    homeMetricsService,
    northService,
    southService,
    engine,
    historyQueryEngine,
    oibusService,
    oianalyticsMessageService,
    proxyServer
  );

  const scanModeService = new ScanModeService(
    new JoiValidator(),
    repositoryService.scanModeRepository,
    repositoryService.southCacheRepository,
    oianalyticsMessageService,
    engine
  );

  const southConnectorConfigService = new SouthConnectorConfigService(
    new JoiValidator(),
    repositoryService.southConnectorRepository,
    repositoryService.southItemRepository,
    repositoryService.scanModeRepository,
    southService,
    reloadService,
    oianalyticsMessageService,
    encryptionService
  );

  const northConnectorConfigService = new NorthConnectorConfigService(
    new JoiValidator(),
    repositoryService.northConnectorRepository,
    repositoryService.subscriptionRepository,
    repositoryService.scanModeRepository,
    northService,
    reloadService,
    oianalyticsMessageService,
    encryptionService
  );

  const commandService = new OianalyticsCommandService(
    repositoryService,
    reloadService,
    encryptionService,
    oianalyticsMessageService,
    scanModeService,
    southConnectorConfigService,
    northConnectorConfigService,
    commandClient,
    loggerService.logger!,
    binaryFolder
  );
  commandService.start();

  const registrationService = new OianalyticsRegistrationService(
    repositoryService,
    encryptionService,
    commandService,
    oianalyticsMessageService,
    reloadService,
    loggerService.logger!
  );
  registrationService.start();
  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    scanModeService,
    reloadService,
    registrationService,
    repositoryService,
    southService,
    northService,
    oibusService,
    engineMetricsService,
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
    await oibusService.stopOIBus();
    await commandService.stop();
    await oianalyticsMessageService.stop();
    await proxyServer.stop();
    await server.stop();
    registrationService.stop();
    loggerService.stop();
    console.info('OIBus stopped');
    stopping = false;
    process.exit();
  });

  const updatedOIBusSettings = repositoryService.engineRepository.get()!;
  loggerService.logger!.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(updatedOIBusSettings))}`);
  console.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(updatedOIBusSettings))}`);
})();
