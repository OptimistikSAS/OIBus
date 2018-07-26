require('dotenv').config()
const server = require('./server')
const fs = require('fs')
const { CronJob } = require('cron')
const ModbusClient = require('./south/modbus/ModbusClient.class')
const configService = require('./services/config.service')

const args = configService.parseArgs() || {} // Arguments of the command
const { configPath = './fTbus.config.json' } = args // Get the configuration file path

// Check if the provided file is json
if (!configPath.endsWith('.json')) {
  console.error('You must provide a json file for the configuration!')
}

/**
 * Tries to read a file at a given path
 * @param {String} path : path to the file to read
 * @return {*} : content of the file
 */
const tryReadFile = (path) => {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) // Get fTbus configuration file
  } catch (error) {
    console.error(error)
    return error
  }
}

const fTbusConfig = tryReadFile(configPath)

const { scanModes, configExemple } = fTbusConfig // Get the cron frequences file path
const frequences = tryReadFile(scanModes)

// Check if the frequences file has been correctly retreived
if (!frequences) {
  console.error('Frequences file not found.')
} 

const port = process.env.PORT || 3333
server.listen(port, () => console.info(`API server started on ${port}`))
