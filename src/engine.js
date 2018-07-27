const { CronJob } = require('cron')
const { parseArgs, tryReadFile } = require('./services/config.service')
const ModbusClient = require('./south/modbus/ModbusClient.class')

const start = (callback = () => {}) => {
  const args = parseArgs() || {} // Arguments of the command
  const { configPath = './fTbus.config.json' } = args // Get the configuration file path

  // Check if the provided file is json
  if (!configPath.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
  }

  const fTbusConfig = tryReadFile(configPath)

  const { scanModes, config } = fTbusConfig // Get the cron frequences file path
  const frequences = tryReadFile(scanModes)

  const modbusClient = new ModbusClient(config)

  // Check if the frequences file has been correctly retreived
  if (!frequences) {
    console.error('Frequences file not found.')
  } else {
    modbusClient.connect('localhost')
    frequences.forEach(({ name, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => modbusClient.poll(name), // @TODO: foreach protocol, run poll
        start: false,
      })

      job.start()
    })
  }
  callback()
}

module.exports = { start }
