const modbus = require('jsmodbus')
const net = require('net')
const { CronJob } = require('cron')
const fs = require('fs')
const configService = require('../../services/config.service')

const socket = new net.Socket()
const client = new modbus.client.TCP(socket)

socket.on('connect', () => {
  const args = configService.parseArgs() || {}
  const { configPath = './fTbus.config.json' } = args // Get the configuration file path

  // Check if the provided file is json
  if (!configPath.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return false
  }

  const fTbusConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const { scanModes } = fTbusConfig
  const frequences = JSON.parse(fs.readFileSync(scanModes, 'utf8')) // Read the cron frequences file
  const optimizedConfig = JSON.parse(fs.readFileSync('./tests/optimizedConfig.json', 'utf8')) // Read configuration file synchronously

  if (!optimizedConfig) {
    console.info('Optimized config file not found. Make sure you generated it correctly.')
    return false
  }

  if (!frequences) {
    console.info('Frequences file not found.')
    return false
  }

  optimizedConfig.forEach((equipment) => {
    const { equipmentId, protocol, variableGroups } = equipment
    Object.keys(variableGroups).forEach((frequenceName) => {
      const typesForFrequence = variableGroups[frequenceName]
      const { frequence: cronTime } = frequences.find(({ name }) => name === frequenceName)
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.keys(typesForFrequence).forEach((type) => {
            const addressesForType = typesForFrequence[type]

            const thenFunction = (resp) => {
              console.log('Response: ', JSON.stringify(resp.response))
            }

            const errorFunction = (error) => {
              console.error(error)
              socket.end()
            }
            let modbusFunction
            switch (type) {
              case 'holdingRegister':
                modbusFunction = (startAddress, count) =>
                  client
                    .readHoldingRegisters(startAddress, count)
                    .then(resp => thenFunction(resp))
                    .catch(error => errorFunction(error))
                break
              case 'inputRegister':
                modbusFunction = (startAddress, count) =>
                  client
                    .readInputRegisters(startAddress, count)
                    .then(resp => thenFunction(resp))
                    .catch(error => errorFunction(error))
                break
              case 'discreteInput':
                modbusFunction = (startAddress, count) =>
                  client
                    .readDiscreteInputs(startAddress, count)
                    .then(resp => thenFunction(resp))
                    .catch(error => errorFunction(error))
                break
              default:
                modbusFunction = (startAddress, count) =>
                  client
                    .readCoils(startAddress, count)
                    .then(resp => thenFunction(resp))
                    .catch(error => errorFunction(error))
                break
            }
            Object.keys(addressesForType).forEach((range) => {
              const addresses = addressesForType[range]
              const rangeAddresses = range.split('-')
              const startAddress = parseInt(rangeAddresses[0], 10)
              const endAddress = parseInt(rangeAddresses[1], 10)
              const rangeSize = endAddress - startAddress
              modbusFunction(startAddress, rangeSize)
            })
          })
        },
        start: false,
      })
      job.start()
    })
  })
  return true
})
module.exports = socket
