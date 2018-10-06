const { CronJob } = require('cron')
const { tryReadFile } = require('../services/config.service')
// South classes
const Modbus = require('../south/Modbus/Modbus.class')
const OPCUA = require('../south/OPCUA/OPCUA.class')
const CSV = require('../south/CSV/CSV.class')
// North classes
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')
// Web Server
const Server = require('../server/Server.class')

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
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and equipments.
   * @param {String} config : path to the config file
   * @return {Object} readConfig : parsed config Object
   */
  constructor(configFile) {
    this.config = tryReadFile(configFile)
    const mandatoryEntries = ['engine.scanModes', 'engine.types', 'south.equipments', 'north.applications']
    mandatoryEntries.forEach((entry) => {
      const [key, subkey] = entry.split('.')
      if (!this.config[key]) {
        console.error(`You should define ${key} in the config file`)
        process.exit(1)
      }
      if (!this.config[key][subkey]) {
        console.error(`You should define ${entry} in the config file`)
        process.exit(1)
      }
    })
    // prepare config
    this.config.south.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        // replace relative path into absolute paths
        if (point.pointId.charAt(0) === '.') {
          point.pointId = equipment.pointIdRoot + point.pointId.slice(1)
        }
        // apply default scanmodes
        if (!point.scanMode) {
          point.scanMode = equipment.defaultScanMode
        }
      })
    })
    /** @type {string} contains one queue per application */
    this.queues = []
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
    // Get the config entries
    const { debug = false, port = 3333, filter = ['127.0.0.1', '::1'] } = this.engine

    // 1. start web server
    const server = new Server(debug, filter)
    server.listen(port, () => console.info(`Server started on ${port}`))

    // 2. start Protocol for each equipments
    this.south.equipments.forEach((equipment) => {
      const { protocol, enabled, equipmentId } = equipment
      // select the correct Handler
      const ProtocolHandler = protocolList[protocol]
      if (enabled) {
        if (ProtocolHandler) {
          activeProtocols[equipmentId] = new ProtocolHandler(equipment, this)
          activeProtocols[equipmentId].connect()
        } else {
          console.error(`Protocol for ${equipmentId}is not supported : ${protocol}`)
          process.exit(1)
        }
      }
    })

    // 3. start Applications
    this.north.applications.forEach((applicationInstance) => {
      const { application, enabled, applicationId } = applicationInstance
      // select the right application
      const ApplicationHandler = applicationList[application]
      if (enabled) {
        if (ApplicationHandler) {
          activeApplications[applicationId] = new ApplicationHandler(application, this)
          activeApplications[application].connect()
        } else {
          console.error(`Application type for ${applicationId} is not supported : ${application}`)
          process.exit(1)
        }
      }
    })

    // 4. start the timers for each scan modes
    this.engine.scanModes.forEach(({ scanMode, cronTime }) => {
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
}

module.exports = Engine
