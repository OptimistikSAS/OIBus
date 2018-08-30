const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

const engine = new Engine()

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

// read the fTbusConfigFile and make it a global variable
global.fTbusConfig = Engine.initConfig(config)

// server cannot be declared if global.fTbusConfig.debug does not exist
const server = require('./server/server')

const { debug = false, port = 3333 } = global.fTbusConfig // Get the config entries

if (debug) console.info('Mode Debug enabled')
// start web server
server.listen(port, () => console.info(`Server started on ${port}`))

// start engine
engine.start(global.fTbusConfig, () => console.info('Engine started.'))
