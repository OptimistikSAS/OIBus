const { parseArgs, tryReadFile } = require('./services/config.service')

// retrieve config file
const args = parseArgs() || {} // Arguments of the command
const { config = './fTbus.json' } = args // Get the configuration file path

// read the fTbusConfigFile and make it a global variable
global.fTbusConfig = tryReadFile(config)

if (global.fTbusConfig.debug === 'debug') console.info('Mode Debug enabled')

const { engine = {}, server = {} } = global.fTbusConfig // Get the config entries

const serverCtrl = require('./server/server')
const engineCtrl = require('./engine/engine')
// start web server
if (!server.port) server.port = 3333
serverCtrl.listen(server.port, () => console.info(`Server started on ${server.port}`))

// start engine
if (!engine.scanModes) {
  console.error('You should define scan modes.')
  throw new Error('You should define scan modes.')
}
engineCtrl.start(engine.scanModes, () => console.info('Engine started.'))

