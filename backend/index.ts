import path from 'node:path';
import WebServer from './web-server/web-server';
import LoggerService from './service/logger/logger.service';
import EncryptionService from './service/encryption.service';

import { createFolder, getCommandLineArguments } from './service/utils';
import RepositoryService from './service/repository.service';
import ReloadService from './service/reload-service';
import ProxyService from './service/proxy.service';
import HealthSignalService from './service/health-signal-service';

const CACHE_FOLDER = './cache';
const SECURITY_FOLDER = './security';

const CONFIG_DATABASE = 'oibus.db';
const LOG_FOLDER_NAME = 'logs';
const LOG_DB_NAME = 'journal.db';

(async () => {
  const { configFile, check } = getCommandLineArguments();

  const baseDir = path.resolve(configFile);
  console.info(`Starting OIBus with base directory ${baseDir}...`);
  process.chdir(baseDir);

  // Create the base cache folder
  await createFolder(CACHE_FOLDER);
  const configDbFilePath = path.resolve(CONFIG_DATABASE);

  const encryptionService = new EncryptionService(SECURITY_FOLDER);
  await encryptionService.init();

  const repositoryService = new RepositoryService(configDbFilePath, path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME));
  const oibusSettings = repositoryService.engineRepository.getEngineSettings();

  if (!oibusSettings) {
    console.error('Error while loading OIBus settings from database');
    return;
  }
  console.info(`OIBus settings loaded. OIBus ID: ${oibusSettings.id} ; OIBus name : ${oibusSettings.name}.`);

  const loggerService = new LoggerService(encryptionService);
  await loggerService.start(oibusSettings.id, oibusSettings.logParameters);

  const proxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);
  const healthSignalService = new HealthSignalService(
    oibusSettings.healthSignal,
    proxyService,
    encryptionService,
    loggerService.createChildLogger('health')
  );

  const reloadService = new ReloadService(loggerService, repositoryService, healthSignalService);

  if (check) {
    console.info('OIBus started in check mode. Exiting process.');
    return;
  }

  const server = new WebServer(
    oibusSettings.id,
    oibusSettings.port,
    encryptionService,
    reloadService,
    loggerService.createChildLogger('web-server'),
    repositoryService
  );
  await server.init();

  console.info('OIBus fully started');
})();
