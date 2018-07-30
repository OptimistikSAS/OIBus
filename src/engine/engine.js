const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()

const start = (config , callback = () => {}) => {

  const modbusClient = new ModbusClient(config, responses)

  // modbusClient.connect('localhost')
  config.scanModes.forEach(({ name, cronTime }) => {
    const job = new CronJob({
      cronTime,
      onTick: () => modbusClient.poll(name), // @TODO: foreach protocol, run poll
      start: false,
    })
    job.start()
  })
  callback()
}


module.exports = { start }
