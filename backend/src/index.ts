import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments } from './service/utils';
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

const CONFIG_DATABASE = 'oibus.db';
const CRYPTO_DATABASE = 'crypto.db';
const CACHE_FOLDER = './cache';
const CACHE_DATABASE = 'cache.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'logs.db';

(async () => {
  const { configFile, check } = getCommandLineArguments();

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
    return;
  }

  await createFolder(LOG_FOLDER_NAME);
  const loggerService = new LoggerService(encryptionService, path.resolve(LOG_FOLDER_NAME));
  await loggerService.start(oibusSettings.id, oibusSettings.name, oibusSettings.logParameters);

  const northService = new NorthService(encryptionService, repositoryService);
  const southService = new SouthService(encryptionService, repositoryService);
  const historyQueryService = new HistoryQueryService(repositoryService);

  const engineMetricsService = new EngineMetricsService(loggerService.logger!, oibusSettings.id, repositoryService.engineMetricsRepository);
  const homeMetricsService = new HomeMetricsService(
    oibusSettings.id,
    engineMetricsService,
    repositoryService.engineMetricsRepository,
    repositoryService.northMetricsRepository,
    repositoryService.southMetricsRepository
  );

  const engine = new OIBusEngine(
    encryptionService,
    northService,
    southService,
    homeMetricsService,
    loggerService.createChildLogger('data-stream')
  );
  const historyQueryEngine = new HistoryQueryEngine(
    encryptionService,
    northService,
    southService,
    historyQueryService,
    loggerService.createChildLogger('history-engine')
  );

  const oibusService = new OIBusService(engine, historyQueryEngine);

  await engine.start();
  await historyQueryEngine.start();

  const reloadService = new ReloadService(
    loggerService,
    repositoryService,
    engineMetricsService,
    homeMetricsService,
    northService,
    southService,
    engine,
    historyQueryEngine
  );
  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    reloadService,
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
  process.on('SIGINT', () => {
    if (stopping) return;
    console.info('SIGINT (Ctrl+C) received. Stopping everything.');
    stopping = true;
    const stopAll = [engine.stop(), historyQueryEngine.stop()];
    Promise.allSettled(stopAll).then(async () => {
      await server.stop();
      loggerService.stop();
      console.info('OIBus stopped');
      process.exit();
      stopping = false;
    });
  });

  loggerService.logger!.info(`OIBus fully started: ${JSON.stringify(oibusService.getOIBusInfo())}`);
  console.info(`OIBus fully started: ${JSON.stringify(oibusService.getOIBusInfo())}`);
})();
