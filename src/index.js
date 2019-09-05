const cluster = require('cluster')

const VERSION = require('../package.json').version

const Engine = require('./engine/Engine.class')

if (cluster.isMaster) {
  // Master role is nothing except launching a worker and relauching another
  // one if exit is detected (typically to load a new configuration)
  console.info(`Starting OIBus version: ${VERSION}`)
  cluster.fork()

  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      console.info(`Worker ${worker.process.pid} was killed by signal: ${signal}`)
    } else {
      console.error(`Worker ${worker.process.pid} exited with error code: ${code}`)
    }

    cluster.fork()
  })
} else {
  // this condition is reached only for a worker (i.e. not master)
  // so this is here where we execute the OIBus Engine
  const engine = new Engine()
  engine.start()

  // Catch Ctrl+C and properly stop the Engine
  process.on('SIGINT', () => {
    engine.logger.info('SIGINT (Ctrl+C) received. Stopping everything.')
    engine.stop().then(() => {
      process.exit()
    })
  })
}
