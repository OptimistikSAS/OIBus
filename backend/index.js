import cluster from 'node:cluster'
import path from 'node:path'

import { version } from './package.json'
import migrationService from './migration/migration.service.js'
import ConfigurationService from './service/configuration.service.js'
import Server from './web-server/web-server.js'
import OIBusEngine from './engine/oibus-engine.js'
import HistoryQueryEngine from './engine/history-query-engine.js'
import LoggerService from './service/logger/logger.service.js'
import EncryptionService from './service/encryption.service.js'

import { getCommandLineArguments, createFolder } from './service/utils.js'
import RepositoryService from './service/repository.service'
import ValidatorService from "./service/validator.service";

// In case there is an error the worker process will exit.
// If this happens MAX_RESTART_COUNT times in less than MAX_INTERVAL_MILLISECOND interval
// it means that there is probably a configuration error, so we restart in safe mode to
// prevent restart loop and make possible changing the configuration
const MAX_RESTART_COUNT = 3
const MAX_INTERVAL_MILLISECOND = 30 * 1000
const CACHE_FOLDER = './cache'
const MAIN_LOG_FILE_NAME = 'main-journal.log'
const CONFIG_FILE_NAME = 'oibus.json'
const CONFIG_DATABASE = 'oibus.db'
const LOG_FOLDER_NAME = 'logs'
const LOG_DB_NAME = 'journal.db'

const loggerService = new LoggerService()

const {
  configFile,
  check,
} = getCommandLineArguments()

const logParameters = {
  consoleLog: { level: 'trace' },
  fileLog: {
    level: 'trace',
    fileName: MAIN_LOG_FILE_NAME,
    maxSize: 10,
    numberOfFiles: 5,
  },
}

if (cluster.isMaster) {
  const baseDir = path.resolve(path.extname(configFile) ? path.parse(configFile).dir : configFile)
  process.chdir(baseDir)
  createFolder(baseDir).then(async () => {
    // Create the base cache folder
    await createFolder(CACHE_FOLDER)

    await loggerService.start('OIBus-main', logParameters)
    const mainLogger = loggerService.createChildLogger('main-thread')
    // Master role is nothing except launching a worker and relaunching another
    // one if exit is detected (typically to load a new configuration)
    mainLogger.info(`Starting OIBus version ${version}.`)

    let restartCount = 0
    let startTime = (new Date()).getTime()

    cluster.fork()

    cluster.on('exit', (sourceWorker, code, signal) => {
      if (signal) {
        mainLogger.info(`Worker ${sourceWorker.process.pid} was killed by signal: ${signal}`)
      } else {
        mainLogger.error(`Worker ${sourceWorker.process.pid} exited with error code: ${code}`)
      }

      // Check if we got a restart loop and go in safe mode
      restartCount += code > 0 ? 1 : 0
      mainLogger.info(`Restart count: ${restartCount}`)
      const safeMode = restartCount >= MAX_RESTART_COUNT

      const endTime = (new Date()).getTime()
      if (safeMode || ((endTime - startTime) > MAX_INTERVAL_MILLISECOND)) {
        restartCount = 0
        startTime = endTime
      }

      cluster.fork({ SAFE_MODE: `${safeMode}` })
    })
    // Handle messages from the worker
    cluster.on('message', (_worker, msg) => {
      switch (msg.type) {
        case 'reload-oibus-engine':
          Object.keys(cluster.workers).forEach((id) => {
            cluster.workers[id].send({ type: 'reload-oibus-engine' })
          })
          break
        case 'reload':
          Object.keys(cluster.workers).forEach((id) => {
            cluster.workers[id].send({ type: 'reload' })
          })
          break
        case 'shutdown':
          Object.keys(cluster.workers).forEach((id) => {
            cluster.workers[id].send({ type: 'shutdown' })
          })
          break
        case 'shutdown-ready':
          loggerService.stop()
          process.exit()
          break
        default:
          mainLogger.warn(`Unknown message type received from Worker: ${msg.type}`)
      }
    })
  })
} else {
  // This condition is reached only for a worker (i.e. not main thread)
  // so this is here where we start the web-server, OIBusEngine and HistoryQueryEngine
  // The base directory has changed in the main thread into the config file directory, so we need to create the path from
  // the basename of the configFile path
  const configFilePath = path.resolve(CONFIG_FILE_NAME)
  const configDbFilePath = path.resolve(CONFIG_DATABASE)
  loggerService.start('OIBus-main', logParameters).then(async () => {
    const forkLogger = loggerService.createChildLogger('forked-thread')

    const repositoryService = new RepositoryService(configDbFilePath, path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME))
    const validatorService = new ValidatorService()

    // Migrate config file, if needed
    await migrationService(configFilePath, loggerService.createChildLogger('migration'))

    const configService = new ConfigurationService(configFilePath, CACHE_FOLDER)
    const encryptionService = EncryptionService.getInstance()
    encryptionService.setKeyFolder(configService.keyFolder)
    encryptionService.setCertsFolder(configService.certFolder)
    await encryptionService.checkOrCreatePrivateKey()
    await encryptionService.checkOrCreateCertFiles()
    await configService.init()

    const safeMode = process.env.SAFE_MODE === 'true'

    const { engineConfig } = configService.getConfig()
    const oibusLoggerService = new LoggerService()
    oibusLoggerService.setEncryptionService(encryptionService)
    await oibusLoggerService.start(engineConfig.name, engineConfig.logParameters)

    const oibusEngine = new OIBusEngine(version, configService, encryptionService, oibusLoggerService)
    const historyQueryEngine = new HistoryQueryEngine(version, configService, encryptionService, oibusLoggerService)
    const server = new Server(
      encryptionService,
      oibusEngine,
      historyQueryEngine,
      oibusLoggerService,
      repositoryService,
      validatorService,
    )

    if (check) {
      forkLogger.warn('OIBus is running in check mode.')
      process.send({ type: 'shutdown-ready' })
    } else {
      oibusEngine.start(safeMode).then(() => {
        forkLogger.info('OIBus engine fully started.')
      })
      historyQueryEngine.start(safeMode).then(() => {
        forkLogger.info('History query engine fully started.')
      })
      server.start().then(() => {
        forkLogger.info('OIBus web server fully started.')
      })
    }

    // Catch Ctrl+C and properly stop the Engine
    process.on('SIGINT', () => {
      forkLogger.info('SIGINT (Ctrl+C) received. Stopping everything.')
      const stopAll = [oibusEngine.stop(), historyQueryEngine.stop(), server.stop()]
      Promise.allSettled(stopAll).then(() => {
        process.exit()
      })
      loggerService.stop()
      oibusLoggerService.stop()
    })

    // Receive messages from the master process.
    process.on('message', async (msg) => {
      switch (msg.type) {
        case 'reload-oibus-engine':
          {
            forkLogger.info('Reloading OIBus Engine')
            await oibusEngine.stop()
            await historyQueryEngine.stop()
            await server.stop()

            // Restart the logger to update its settings
            oibusLoggerService.stop()
            const { engineConfig: newEngineConfig } = configService.getConfig()
            await oibusLoggerService.start(newEngineConfig.name, newEngineConfig.logParameters)

            oibusEngine.start(safeMode).then(() => {
              forkLogger.info('OIBus engine fully started.')
            })
            historyQueryEngine.start(safeMode).then(() => {
              forkLogger.info('History engine fully started.')
            })
            server.start().then(() => {
              forkLogger.info('OIBus web server fully started.')
            })
          }
          break
        case 'reload':
          forkLogger.info('Reloading OIBus')
          oibusLoggerService.stop()
          Promise.allSettled([oibusEngine.stop(), historyQueryEngine.stop(), server.stop()]).then(() => {
            process.exit()
          })
          break
        case 'shutdown':
          forkLogger.info('Shutting down OIBus')
          Promise.allSettled([oibusEngine.stop(), historyQueryEngine.stop(), server?.stop()]).then(() => {
            process.send({ type: 'shutdown-ready' })
          })
          break
        default:
          forkLogger.warn(`Unknown message type received from Master: ${msg.type}`)
      }
    })
  })
}
