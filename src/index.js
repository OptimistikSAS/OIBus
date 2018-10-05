const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')
const Server = require('./server/Server.class')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

// read the fTbusConfigFile and make it a global variable
global.fTbusConfig = Engine.loadConfig(config)
const { debug = false, port = 3333 } = global.fTbusConfig // Get the config entries
const VERSION = require('../package.json').version

const engine = new Engine()
const server = new Server(debug)

if (debug) console.info('Mode Debug enabled')
console.info(`fTbus version ${VERSION}`)

// start web server
server.listen(port, () => console.info(`Server started on ${port}`))

// start engine
engine.start(global.fTbusConfig, () => console.info('Engine started.'))
