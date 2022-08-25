const cluster = require('node:cluster')
const path = require('node:path')

const VERSION = require('../package.json').version

const migrationService = require('./migration/migration.service')
const ConfigService = require('./services/config.service.class')
const Server = require('./server/Server.class')
const OIBusEngine = require('./engine/OIBusEngine.class')
const HistoryQueryEngine = require('./HistoryQuery/HistoryQueryEngine.class')
const Logger = require('./engine/logger/Logger.class')
const EncryptionService = require('./services/EncryptionService.class')

const { getCommandLineArguments } = require('./services/utils')

// In case there is an error the worker process will exit.
// If this happens MAX_RESTART_COUNT times in less than MAX_INTERVAL_MILLISECOND interval
// it means that there is probably a configuration error, so we restart in safe mode to
// prevent restart loop and make possible changing the configuration
const MAX_RESTART_COUNT = 3
const MAX_INTERVAL_MILLISECOND = 30 * 1000

const logger = new Logger()

const {
  configFile,
  check,
} = getCommandLineArguments()

logger.changeParameters({
  engineName: 'OIBus-main',
  logParameters: {
    consoleLog: { level: 'debug' },
    fileLog: {
      level: 'debug',
      fileName: `${path.parse(configFile).dir}/OIBus-main-journal.log`,
      maxSize: 1000000,
      numberOfFiles: 5,
      tailable: true,
    },
    sqliteLog: { level: 'none' },
    lokiLog: { level: 'none' },
  },
}).then(() => {
  if (cluster.isMaster) {
    // Master role is nothing except launching a worker and relaunching another
    // one if exit is detected (typically to load a new configuration)
    logger.info(`Starting OIBus version: ${VERSION}`)

    let restartCount = 0
    let startTime = (new Date()).getTime()

    cluster.fork()

    cluster.on('exit', (sourceWorker, code, signal) => {
      if (signal) {
        logger.info(`Worker ${sourceWorker.process.pid} was killed by signal: ${signal}`)
      } else {
        logger.error(`Worker ${sourceWorker.process.pid} exited with error code: ${code}`)
      }

      // Check if we got a restart loop and go in safe mode
      restartCount += code > 0 ? 1 : 0
      logger.info(`Restart count: ${restartCount}`)
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
          Object.keys(cluster.workers)
            .forEach((id) => {
              cluster.workers[id].send({ type: 'reload-oibus-engine' })
            })
          break
        case 'reload-historyquery-engine':
          Object.keys(cluster.workers)
            .forEach((id) => {
              cluster.workers[id].send({ type: 'reload-historyquery-engine' })
            })
          break
        case 'reload':
          Object.keys(cluster.workers)
            .forEach((id) => {
              cluster.workers[id].send({ type: 'reload' })
            })
          break
        case 'shutdown':
          Object.keys(cluster.workers)
            .forEach((id) => {
              cluster.workers[id].send({ type: 'shutdown' })
            })
          break
        case 'shutdown-ready':
          process.exit()
          break
        default:
          logger.warn(`Unknown message type received from Worker: ${msg.type}`)
      }
    })
  } else {
    process.chdir(path.parse(configFile).dir)

    // Migrate config file, if needed
    migrationService.migrate(configFile).then(async () => {
      // this condition is reached only for a worker (i.e. not master)
      // so this is here where we start the web-server, OIBusEngine and HistoryQueryEngine

      const configService = new ConfigService(configFile)
      await configService.init()

      const encryptionService = EncryptionService.getInstance()
      encryptionService.setKeyFolder(configService.keyFolder)
      encryptionService.setCertsFolder(configService.certFolder)
      encryptionService.checkOrCreatePrivateKey()
      encryptionService.checkOrCreateCertFiles()

      const safeMode = process.env.SAFE_MODE === 'true'

      const oibusEngine = new OIBusEngine(configService, encryptionService)
      const historyQueryEngine = new HistoryQueryEngine(configService, encryptionService)
      const server = new Server(encryptionService, oibusEngine, historyQueryEngine)

      if (check) {
        logger.warn('OIBus is running in check mode')
        process.send({ type: 'shutdown-ready' })
      } else {
        oibusEngine.start(safeMode)
        historyQueryEngine.start(safeMode)
        server.start()
      }

      // Catch Ctrl+C and properly stop the Engine
      process.on('SIGINT', () => {
        logger.info('SIGINT (Ctrl+C) received. Stopping everything.')
        const stopAll = [oibusEngine.stop(), historyQueryEngine.stop(), server.stop()]
        Promise.allSettled(stopAll)
          .then(() => {
            process.exit()
          })
      })

      // Receive messages from the master process.
      process.on('message', async (msg) => {
        switch (msg.type) {
          case 'reload-oibus-engine':
            logger.info('Reloading OIBus Engine')
            await oibusEngine.stop()
            await server.stop()
            oibusEngine.start(safeMode)
            server.start()
            break
          case 'reload-historyquery-engine':
            logger.info('Reloading HistoryQuery Engine')
            await historyQueryEngine.stop()
            historyQueryEngine.start(safeMode)
            break
          case 'reload':
            logger.info('Reloading OIBus')
            Promise.allSettled([oibusEngine.stop(), historyQueryEngine.stop(), server.stop()])
              .then(() => {
                process.exit()
              })
            break
          case 'shutdown':
            logger.info('Shutting down OIBus')
            Promise.allSettled([oibusEngine.stop(), historyQueryEngine.stop(), server?.stop()])
              .then(() => {
                process.send({ type: 'shutdown-ready' })
              })
            break
          default:
            logger.warn(`Unknown message type received from Master: ${msg.type}`)
        }
      })
    })
  }
})
