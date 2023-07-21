import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments } from './service/utils';
import RepositoryService from './service/repository.service';
import ReloadService from './service/reload.service';
import HealthSignalService from './service/health-signal.service';
import NorthService from './service/north.service';
import SouthService from './service/south.service';
import OIBusEngine from './engine/oibus-engine';
import HistoryQueryEngine from './engine/history-query-engine';
import HistoryQueryService from './service/history-query.service';
import OIBusService from './service/oibus.service';
import migrate from './db/migration-service';

const CACHE_FOLDER = './cache';

const CONFIG_DATABASE = 'oibus.db';
const CRYPTO_DATABASE = 'crypto.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'journal.db';

(async () => {
  const { configFile, check } = getCommandLineArguments();

  const baseDir = path.resolve(configFile);
  console.info(`Starting OIBus with base directory ${baseDir}...`);
  process.chdir(baseDir);

  // Create the base cache folder
  await createFolder(CACHE_FOLDER);
  await createFolder(LOG_FOLDER_NAME);

  // run migrations
  await migrate(path.resolve(CONFIG_DATABASE));

  const repositoryService = new RepositoryService(
    path.resolve(CONFIG_DATABASE),
    path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME),
    path.resolve(CRYPTO_DATABASE)
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
    return;
  }

  const loggerService = new LoggerService(encryptionService);
  await loggerService.start(oibusSettings.id, oibusSettings.name, oibusSettings.logParameters);

  const northService = new NorthService(encryptionService, repositoryService);
  const southService = new SouthService(encryptionService, repositoryService);
  const historyQueryService = new HistoryQueryService(encryptionService, repositoryService);

  const engine = new OIBusEngine(encryptionService, northService, southService, loggerService.createChildLogger('engine'));
  const historyQueryEngine = new HistoryQueryEngine(
    encryptionService,
    northService,
    southService,
    historyQueryService,
    loggerService.createChildLogger('history')
  );

  const oibusService = new OIBusService(engine, historyQueryEngine);
  await engine.start();
  await historyQueryEngine.start();
  const healthSignalService = new HealthSignalService(loggerService.createChildLogger('health'));

  const reloadService = new ReloadService(
    loggerService,
    repositoryService,
    healthSignalService,
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
    healthSignalService,
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
