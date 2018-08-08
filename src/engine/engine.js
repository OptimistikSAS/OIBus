const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()
const protocols = {}

const start = (config, callback = () => {}) => {
  const protocolList = { modbus: ModbusClient }
  Object.values(config.equipments).forEach((equipment) => {
    if (!protocols[equipment.protocol]) {
      protocols[equipment.protocol] = new protocolList[equipment.protocol](config, responses)
    }
    protocols[equipment.protocol].add(equipment)
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
