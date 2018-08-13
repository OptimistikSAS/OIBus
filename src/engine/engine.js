const { CronJob } = require('cron')
const Modbus = require('../south/modbus/Modbus.class')
const ResponsesHandler = require('./ResponsesHandler.class')

const responses = new ResponsesHandler()
const activeProtocols = {}
const protocolList = { modbus: Modbus }

const start = (config, callback = () => {}) => {
  // adds every protocol to be used in activeProtocols
  Object.values(config.equipments).forEach((equipment) => {
    if (!activeProtocols[equipment.protocol]) {
      activeProtocols[equipment.protocol] = new protocolList[equipment.protocol](config, responses)
    }
  })
  // Object.values(config.applications).forEach((application))
  Object.keys(activeProtocols).forEach(key => activeProtocols[key].connect())
  config.scanModes.forEach(({ scanMode, cronTime }) => {
    const job = new CronJob({
      cronTime,
      onTick: () => {
        Object.keys(activeProtocols).forEach(key => activeProtocols[key].onScan(scanMode)) // à changer dans Modbus
        // Object.keys(activeApplications)forEach(key => activeApplications[key].onScan(scanMode))
      },
      start: false,
    })
    job.start()
  })
  callback()
}

module.exports = { start }
