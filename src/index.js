const cluster = require('cluster')
const path = require('path')

const VERSION = require('../package.json').version

const migrationService = require('./migration/migration.service')
const ConfigService = require('./services/config.service.class')
const Engine = require('./engine/Engine.class')
const Logger = require('./engine/Logger.class')

const logger = new Logger('main')

// used to pretty print memusage output
const memStringify = ({ rss, heapTotal, heapUsed, external }) => (`
  rss: ${Number(rss / 1024 / 1024).toFixed(2)}
  heapTotal: ${Number(heapTotal / 1024 / 1024).toFixed(2)}
  heapUsed: ${Number(heapUsed / 1024 / 1024).toFixed(2)}
  external: ${Number(external / 1024 / 1024).toFixed(2)}
`)

if (cluster.isMaster) {
  // Master role is nothing except launching a worker and relauching another
  // one if exit is detected (typically to load a new configuration)
  logger.info(`Starting OIBus version: ${VERSION}`)
  cluster.fork()

  cluster.on('exit', (sourceWorker, code, signal) => {
    if (signal) {
      logger.info(`Worker ${sourceWorker.process.pid} was killed by signal: ${signal}`)
    } else {
      logger.error(`Worker ${sourceWorker.process.pid} exited with error code: ${code}`)
    }

    cluster.fork()
  })
  // Handle messages from the worker
  cluster.on('message', (_worker, msg) => {
    if (msg.type === 'logMemoryUsage') {
      logger.info(`memoryUsage worker: ${memStringify(msg.memoryUsage)}`)
      logger.info(`memoryUsage master:', ${memStringify(process.memoryUsage())}`)
    } else {
      logger.warn(`Unknown message type received from Worker: ${msg.type}`)
    }
  })
} else {
  const configFile = ConfigService.getConfigFile(logger)
  process.chdir(path.parse(configFile).dir)

  // Migrate config file, if needed
  migrationService.migrate(configFile)

  // this condition is reached only for a worker (i.e. not master)
  // so this is here where we execute the OIBus Engine
  const engine = new Engine(configFile)
  engine.start()

  // Catch Ctrl+C and properly stop the Engine
  process.on('SIGINT', () => {
    logger.info('SIGINT (Ctrl+C) received. Stopping everything.')
    engine.stop().then(() => {
      process.exit()
    })
  })
}
