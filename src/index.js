const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

const engine = new Engine(config)
// start engine
engine.start()
