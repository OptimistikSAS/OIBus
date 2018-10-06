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
  constructor(config) {
    /** @type {string} contains one queue per application */
    this.queues = []
    this.config = config
  }

  /**
   * send a Value from an equipement to application queues
   * @param {Object} value : new value (pointId, timestamp and data of the entry)
   * @return {void}
   */
  addValue({ data, dataId, pointId, timestamp }) {
    this.queues.forEach((queue) => {
      queue.enqueue({ data, dataId, pointId, timestamp })
    })
    Object.values(activeApplications).forEach(application => application.onUpdate())
  }

  /**
   * Registers a new queue in the Engine
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
  start(callback) {
    // start Protocol for each equipments
    this.config.south.equipments.forEach((equipment) => {
      const { protocol, enabled, equipmentId } = equipment
      const Protocol = protocolList[protocol]
      if (enabled) {
        if (Protocol) {
          activeProtocols[equipmentId] = new Protocol(equipment, this.config.south)
          activeProtocols[equipmentId].connect()
        } else {
          console.error('This protocol is not supported : ', protocol)
        }
      }
    })
    // start Applications
    this.config.north.applications.forEach((application) => {
      const { applicationType, enabled, applicationId } = application
      const Application = applicationList[applicationType]
      if (enabled) {
        if (Application) {
          activeApplications[applicationId] = new Application(application, this.config.north)
          activeApplications[applicationType].connect()
        } else {
          console.error('This application is not supported : ', applicationType)
        }
      }
    })
    // start the cron timer
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => {
          // on each scan, activate each protocols
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
    const mandatoryEntries = ['engine.scanModes', 'engine.types', 'south.equipments']
    mandatoryEntries.forEach((entry) => {
      const [key, subkey] = entry.split('.')
      if (!readConfig[key]) {
        console.error(`You should define ${key} in the config file`)
        process.exit(1)
      }
      if (!readConfig[key][subkey]) {
        console.error(`You should define ${entry} in the config file`)
        process.exit(1)
      }
    })
    // replace relative path into absolute paths
    readConfig.south.equipments.forEach((equipment) => {
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
