const { CronJob } = require('cron')
const ModbusClient = require('../south/modbus/ModbusClient.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()
const activeProtocols = {}
const protocolList = { modbus: ModbusClient }

const start = (config, callback = () => {}) => {
  // adds every protocol to be used in activeProtocols
  Object.values(config.equipments).forEach((equipment) => {
    if (!activeProtocols[equipment.protocol]) {
      activeProtocols[equipment.protocol] = new protocolList[equipment.protocol](config, responses)
    }
  })
  Object.keys(activeProtocols).forEach(key => activeProtocols[key].connect())
  config.scanModes.forEach(({ scanMode, cronTime }) => {
    const job = new CronJob({
      cronTime,
      onTick: () => Object.keys(activeProtocols).forEach(key => activeProtocols[key].poll(scanMode)),
      start: false,
    })
    job.start()
  })
  callback()
}

module.exports = { start }
