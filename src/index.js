const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

const VERSION = require('../package.json').version

const engine = new Engine(config)
// start engine
engine
  .start()
  .then(() => console.info(`fTbus version ${VERSION} started`))
  .catch((error) => {
    console.error(error.message)
    process.exit(-1)
  })
