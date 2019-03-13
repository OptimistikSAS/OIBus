const cluster = require('cluster')

const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

if (cluster.isMaster) {
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
  const engine = new Engine(config)
  engine.start()
}
