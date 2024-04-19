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
import CommandService from './service/oia/command.service';
import RegistrationService from './service/oia/registration.service';
import ProxyServer from './web-server/proxy-server';
import ConnectionService from './service/connection.service';

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

  const oibusSettings = repositoryService.engineRepository.getEngineSettings();
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
    repositoryService.registrationRepository.getRegistrationSettings()
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

  const commandService = new CommandService(repositoryService, encryptionService, loggerService.logger!, binaryFolder);
  commandService.start();

  const oibusService = new OIBusService(engine, historyQueryEngine);

  await engine.start();
  await historyQueryEngine.start();

  const proxyServer = new ProxyServer(loggerService.logger!);
  const ipFilters = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    ...repositoryService.ipFilterRepository.getIpFilters().map(filter => filter.address)
  ];
  proxyServer.refreshIpFilters(ipFilters);

  if (oibusSettings.proxyEnabled) {
    await proxyServer.start(oibusSettings.proxyPort);
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
    proxyServer
  );

  const registrationService = new RegistrationService(
    repositoryService,
    encryptionService,
    commandService,
    reloadService,
    loggerService.logger!
  );
  registrationService.start();
  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    reloadService,
    registrationService,
    repositoryService,
    southService,
    northService,
    oibusService,
    engineMetricsService,
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
    await proxyServer.stop();
    await server.stop();
    registrationService.stop();
    loggerService.stop();
    console.info('OIBus stopped');
    stopping = false;
    process.exit();
  });

  loggerService.logger!.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(oibusSettings))}`);
  console.info(`OIBus fully started: ${JSON.stringify(getOIBusInfo(oibusSettings))}`);
})();
