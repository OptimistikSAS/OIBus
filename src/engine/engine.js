const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()
const protocols = {}

const start = (config, callback = () => {}) => {
    // const protocols = [new ModbusClient(config, responses)]
  Object.entries(config.equipments).forEach(([equipmentId, equipment]) => {
    const protocolClient = `${equipment.protocol}Client`
    protocols[equipmentId] = new [protocolClient](responses, equipment.modbus.address, equipment.modbus.port)
  })
  Object.keys(protocols).forEach(key => protocols[key].connect())
  config.scanModes.forEach(({ scanMode, cronTime }) => {
    const job = new CronJob({
      cronTime,
      onTick: () => Object.keys(protocols).forEach(key => protocols[key].poll(scanMode)),
      start: false,
    })
    job.start()
  })
  callback()
}

module.exports = { start }
