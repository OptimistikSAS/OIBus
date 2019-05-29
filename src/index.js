const cluster = require('cluster')

const VERSION = require('../package.json').version

const { parseArgs, checkOrCreateConfigFile } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

if (cluster.isMaster) {
  console.info(`Starting OIBus version: ${VERSION}`)
  // Fork a worker
  cluster.fork()

  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      console.info(`Worker ${worker.process.pid} was killed by signal: ${signal}`)
    } else {
      console.info(`Worker ${worker.process.pid} exited with error code: ${code}`)
    }

    cluster.fork()
  })
} else {
  const args = parseArgs() || {} // Arguments of the command

  const { config = './oibus.json' } = args // Get the configuration file path

  checkOrCreateConfigFile(config) // Create default config file if it doesn't exist
  const engine = new Engine(config)
  engine.start()
}
