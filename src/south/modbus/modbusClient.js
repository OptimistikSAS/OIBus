const modbus = require('jsmodbus')
const net = require('net')
const { CronJob } = require('cron')
const fs = require('fs')
const configService = require('../../services/config.service')
const getConfig = require('./config/modbus.config')

const socket = new net.Socket()
const client = new modbus.client.TCP(socket)

socket.on('connect', () => {
  const args = configService.parseArgs() || {} // Arguments of the command
  const { configPath = './fTbus.config.json' } = args // Get the configuration file path

  // Check if the provided file is json
  if (!configPath.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return false
  }

  const fTbusConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) // Get fTbus configuration file
  const { scanModes } = fTbusConfig // Get the cron frequences file path
  const frequences = JSON.parse(fs.readFileSync(scanModes, 'utf8')) // Read the cron frequences file
  const optimizedConfig = getConfig() // Read optimized configuration file

  // Check if the optimized configuration is correctly set
  if (!optimizedConfig) {
    console.info('Optimized config file not found. Make sure you generated it correctly.')
    return false
  }

  // Check if the frequences file has been correctly retreived
  if (!frequences) {
    console.info('Frequences file not found.')
    return false
  }

  optimizedConfig.forEach((equipment) => {
    const { variableGroups } = equipment
    Object.keys(variableGroups).forEach((frequenceName) => {
      const typesForFrequence = variableGroups[frequenceName]
      const { frequence: cronTime } = frequences.find(({ name }) => name === frequenceName)
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.keys(typesForFrequence).forEach((type) => {
            const addressesForType = typesForFrequence[type] // Addresses of the group

            const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s` // Build function name, IMPORTANT: type must be singular

            // Dynamic call of the appropriate function based on type
            const modbusFunction = (startAddress, count) =>
              client[funcName](startAddress, count)
                .then((resp) => {
                  console.log('Response: ', JSON.stringify(resp.response))
                })
                .catch((error) => {
                  console.error(error)
                  socket.end()
                })

            Object.keys(addressesForType).forEach((range) => {
              const rangeAddresses = range.split('-')
              const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
              const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
              const rangeSize = endAddress - startAddress // Size of the addresses group
              modbusFunction(startAddress, rangeSize)
            })
          })
        },
        start: false,
      })
      job.start() // Run the job
    })
  })
  return true
})
module.exports = socket
