const cluster = require('cluster')
const path = require('path')

const VERSION = require('../package.json').version

const migrationService = require('./migration/migration.service')
const ConfigService = require('./services/config.service.class')
const Engine = require('./engine/Engine.class')
const Logger = require('./engine/Logger.class')

const LOG_SOURCE = 'main'

global.logger = new Logger()

if (cluster.isMaster) {
  // Master role is nothing except launching a worker and relauching another
  // one if exit is detected (typically to load a new configuration)
  logger.info(`Starting OIBus version: ${VERSION}`, LOG_SOURCE)
  cluster.fork()

  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      logger.info(`Worker ${worker.process.pid} was killed by signal: ${signal}`, LOG_SOURCE)
    } else {
      logger.error(`Worker ${worker.process.pid} exited with error code: ${code}`, LOG_SOURCE)
    }

    cluster.fork()
  })
} else {
  const configFile = ConfigService.getConfigFile()
  process.chdir(path.parse(configFile).dir)

  // Migrate config file, if needed
  migrationService.migrate(configFile)

  // this condition is reached only for a worker (i.e. not master)
  // so this is here where we execute the OIBus Engine
  const engine = new Engine(configFile)
  engine.start()

  // Catch Ctrl+C and properly stop the Engine
  process.on('SIGINT', () => {
    logger.info('SIGINT (Ctrl+C) received. Stopping everything.', LOG_SOURCE)
    engine.stop().then(() => {
      process.exit()
    })
  })
}
