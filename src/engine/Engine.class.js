const { CronJob } = require('cron')
const Modbus = require('../south/Modbus/Modbus.class')
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')
const { tryReadFile } = require('../services/config.service')

const protocolList = { Modbus }

const applicationList = {
  Console,
  InfluxDB,
}
// manage la responses de toutes les app
const activeProtocols = {}
const activeApplications = {}


/**
 * Class ResponsesHandler : allows to manage requests responses in a Map
 */
class Engine {
  /**
   * Constructor for the class ResponsesHandler
   */
  constructor() {
    this.queues = []
  }

  /**
   * Fills the map with as many Arrays as there are pointId's in the config file
   * With the pointId as a key.
   * @return {void}
   */

  /**
   * Updates the responses map
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @param {Function} callback : callback function
   * @return {void}
   */

  addValue({ pointId, timestamp, data }) {
    this.queues.forEach((queue) => {
      queue.enqueue({ pointId, timestamp, data })
      queue.info()
    })
  }

  remove({ pointId, timestamp }, queue, callback) {
    console.log(this.queues[queue][pointId].remove(timestamp))
    if (callback) callback()
  }

  info() {
    return { queues: this.queues.length }
  }

  registerQueue(queue) {
    this.queues.push(queue)
  }


  start(config, callback) {
    // adds every protocol and application to be used in activeProtocols and activeApplications
    Object.values(config.equipments).forEach((equipment) => {
      const { protocol } = equipment
      if (!activeProtocols[protocol]) {
        activeProtocols[protocol] = new protocolList[protocol](config, this)
        //
      }
    })
    Object.values(config.applications).forEach((application) => {
      const { type } = application
      if (!activeApplications[type]) {
        activeApplications[type] = new applicationList[type](this)
        //
      }
    })
    Object.keys(activeProtocols).forEach(protocol => activeProtocols[protocol].connect())
    Object.keys(activeApplications).forEach(application => activeApplications[application].connect())
    config.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.keys(activeProtocols).forEach(protocol => activeProtocols[protocol].onScan(scanMode))
          Object.keys(activeApplications).forEach(application => activeApplications[application].onScan(scanMode))
        },
        start: false,
      })
      job.start()
    })
    if (callback) callback()
  }

  static initConfig(config) {
    const readConfig = tryReadFile(config)
    readConfig.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        if (point.pointId.charAt(0) === '.') {
          point.pointId = equipment.pointIdRoot + point.pointId.slice(1)
        }
      })
    })
    return readConfig
  }
}

module.exports = Engine
