const { parseArgs } = require('./services/config.service')
const Engine = require('./engine/Engine.class')

const engine = new Engine()

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

// read the fTbusConfigFile and make it a global variable
global.fTbusConfig = Engine.initConfig(config)
const server = require('./server/server')

const { debug = false, port = 3333, scanModes, equipments } = global.fTbusConfig // Get the config entries

if (debug) console.info('Mode Debug enabled')
// start web server
server.listen(port, () => console.info(`Server started on ${port}`))
// start engine
if (!scanModes) {
  console.error('You should define scan modes.')
  throw new Error('You should define scan modes.')
}
if (!equipments) {
  console.error('You should define equipments.')
  throw new Error('You should define equipments.')
}
engine.start(global.fTbusConfig, () => console.info('Engine started.'))
