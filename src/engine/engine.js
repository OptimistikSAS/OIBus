const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()

const start = (config , callback = () => {}) => {

  const protocols = [
    new ModbusClient(config, responses),
  ]

  // modbusClient.connect('localhost')
  config.scanModes.forEach(({ scanMode, cronTime }) => {
    const job = new CronJob({
      cronTime,
      onTick: () => protocols.forEach(protocol => protocol.poll(scanMode)),
      start: false,
    })
    job.start()
  })
  callback()
}


module.exports = { start }
