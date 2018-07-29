const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')

const start = (scanModes, callback = () => {}) => {
  const modbusClient = new ModbusClient('./tests/config.json')

  // modbusClient.connect('localhost')
  scanModes.forEach(({ name, cronTime }) => {
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
