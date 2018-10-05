const { CronJob } = require('cron')
const { tryReadFile } = require('../services/config.service')
// South classes
const Modbus = require('../south/Modbus/Modbus.class')
const OPCUA = require('../south/OPCUA/OPCUA.class')
const CSV = require('../south/CSV/CSV.class')
// North classes
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')

// List all South protocols
const protocolList = {
  Modbus,
  OPCUA,
  CSV,
}

// List all North applications
const applicationList = {
  Console,
  InfluxDB,
}
// Will only contain protocols/application used
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
  addValue({ data, dataId, pointId, timestamp }) {
    this.queues.forEach((queue) => {
      queue.enqueue({ data, dataId, pointId, timestamp })
      // queue.info()
    })
    Object.values(activeApplications).forEach(application => application.onUpdate())
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
      if (!activeProtocols[protocol] && config.south[protocol].enabled) {
        if (protocolList[protocol]) {
          activeProtocols[protocol] = new protocolList[protocol](config, this)
          activeProtocols[protocol].connect()
        } else {
          console.error('This protocol is not supported : ', protocol)
        }
      }
    })
    // start Applications
    Object.values(config.north).forEach((application) => {
      const { type } = application
      if (application.enabled) {
        if (applicationList[type]) {
          activeApplications[type] = new applicationList[type](this, application)
          activeApplications[type].connect()
        } else {
          console.error('This application is not supported : ', type)
        }
      }
    })
    // start the cron timer
    config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.values(activeProtocols).forEach(protocol => protocol.onScan(scanMode))
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
  static loadConfig(config) {
    const readConfig = tryReadFile(config)
    // Check critical entries
    if (!readConfig.engine.scanModes) {
      console.error('You should define scan modes.')
      throw new Error('You should define scan modes.')
    }
    if (!readConfig.equipments) {
      console.error('You should define equipments.')
      throw new Error('You should define equipments.')
    }
    if (!readConfig.engine.types) {
      console.error('You should define types.')
      throw new Error('You should define types.')
    }
    if (!readConfig.north) {
      console.error('You should define application parameters.')
      throw new Error('You should define application parameters.')
    }
    if (!readConfig.south) {
      console.error('You should define protocol parameters.')
      throw new Error('You should define protocol parameters.')
    }
    // replace relative path into absolute paths
    readConfig.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        if (point.pointId.charAt(0) === '.') {
          point.pointId = equipment.pointIdRoot + point.pointId.slice(1)
        }
        if (!point.scanMode) {
          point.scanMode = equipment.defaultScanMode
        }
      })
    })
    return readConfig
  }
}

module.exports = Engine
