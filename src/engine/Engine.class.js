const { CronJob } = require('cron')
const { tryReadFile } = require('../services/config.service')
// South classes
const Modbus = require('../south/Modbus/Modbus.class')
const OPCUA = require('../south/OPCUA/OPCUA.class')
// North classes
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')

// List all South protocols
const protocolList = { Modbus, OPCUA }

// List all North applications
const applicationList = {
  Console,
  InfluxDB,
}
// Will only contains protocols/application used
// based on the config file
const activeProtocols = {}
const activeApplications = {}


/**
 * Class Engine :
 * - at startup, handles initialization of applications, protocols and config.
 * - allows to manage the queues for every protocol and application.
 */
class Engine {
  /**
   * @constructor for Engine
   */
  constructor() {
    this.queues = []
  }

  /**
   * Updates every queue with a new entry
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @return {void}
   */
  addValue({ pointId, timestamp, data }) {
    this.queues.forEach((queue) => {
      queue.enqueue({ pointId, timestamp, data })
      // queue.info()
    })
  }

  /**
   * Registers a new queue in the list
   * @param {Object} queue : the Queue Object to be added
   * @return {void}
   */
  registerQueue(queue) {
    this.queues.push(queue)
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @param {String} config : the config Object
   * @param {Function} callback
   * @return {void}
   */
  start(config, callback) {
    // start Protocols
    Object.values(config.equipments).forEach((equipment) => {
      const { protocol } = equipment
      if (!activeProtocols[protocol]) {
        activeProtocols[protocol] = new protocolList[protocol](config, this)
        activeProtocols[protocol].connect()
      }
    })
    // start Applications
    Object.values(config.applications).forEach((application) => {
      const { type } = application
      if (!activeApplications[type]) {
        activeApplications[type] = new applicationList[type](this, application)
        activeApplications[type].connect()
      }
    })
    // start the cron timer
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

  /**
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for scanModes and equipments.
   * @param {String} config : path to the config file
   * @return {Object} readConfig : parsed config Object
   */
  static initConfig(config) {
    const readConfig = tryReadFile(config)
    // Check critical entries
    if (!readConfig.scanModes) {
      console.error('You should define scan modes.')
      throw new Error('You should define scan modes.')
    }
    if (!readConfig.equipments) {
      console.error('You should define equipments.')
      throw new Error('You should define equipments.')
    }
    // replace relative path into absolute paths
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
