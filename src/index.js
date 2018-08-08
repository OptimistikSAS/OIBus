const { parseArgs, tryReadFile } = require('./services/config.service')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

// read the fTbusConfigFile and make it a global variable
global.fTbusConfig = tryReadFile(config)

const { debug = false, port = 3333, scanModes, equipments } = global.fTbusConfig // Get the config entries

if (debug) console.info('Mode Debug enabled')
const server = require('./server/server')
const engine = require('./engine/engine')
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
