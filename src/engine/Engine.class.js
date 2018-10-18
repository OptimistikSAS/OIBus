const { CronJob } = require('cron')
const { tryReadFile } = require('../services/config.service')
// South classes
const Modbus = require('../south/Modbus/Modbus.class')
const OPCUA = require('../south/OPCUA/OPCUA.class')
const CSV = require('../south/CSV/CSV.class')
const MQTT = require('../south/MQTT/MQTT.class')
// North classes
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')
// Web Server
const Server = require('../server/Server.class')
// Logger
const Logger = require('../../tests/Logger.class')
// List all South protocols
const protocolList = {
  MQTT,
  Modbus,
  OPCUA,
  CSV,
}

// List all North applications
const apiList = {
  Console,
  InfluxDB,
}

const checkConfig = (config) => {
  const mandatoryEntries = [
    'engine.scanModes',
    'engine.types',
    'engine.port',
    'engine.user',
    'engine.password',
    'south.equipments',
    'north.applications',
  ]
  mandatoryEntries.forEach((entry) => {
    const [key, subkey] = entry.split('.')
    if (!config[key]) {
      throw new Error(`You should define ${key} in the config file`)
    }
    if (!config[key][subkey]) {
      throw new Error(`You should define ${entry} in the config file`)
    }
  })
}

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
    checkConfig(this.config)
    // prepare config
    // initialize the scanMode object with empty arrays
    this.scanModes = {}
    this.config.engine.scanModes.forEach(({ scanMode }) => {
      this.scanModes[scanMode] = []
    })

    this.config.south.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        // 1.replace relative path into absolute paths
        if (point.pointId.charAt(0) === '.') {
          point.pointId = equipment.pointIdRoot + point.pointId.slice(1)
        }
        // 2.apply default scanmodes to each points
        if (!point.scanMode) {
          point.scanMode = equipment.defaultScanMode
        }
        // 3. Associate the scanMode to all it's corresponding equipments
        if (equipment.enabled) {
          if (this.scanModes[point.scanMode] && !this.scanModes[point.scanMode].includes(equipment.equipmentId)) {
            this.scanModes[point.scanMode].push(equipment.equipmentId)
          }
        }
      })
    })
    /** @type {string} contains one queue per application */
    this.queues = []
    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}

    // Configure and get the logger
    this.logger = new Logger(this.config.engine.logParameters).getLogger()
  }

  /**
   * send a Value from an equipement to application queues
   * @param {Object} value : new value (pointId, timestamp and data of the entry)
   * @return {void}
   */
  addValue({ data, dataId, pointId, timestamp }) {
    Object.values(this.activeApis).forEach((application) => {
      application.enqueue({ data, dataId, pointId, timestamp })
      application.onUpdate()
    })
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @param {String} config : the config Object
   * @param {Function} callback
   * @return {void}
   */
  start(callback) {
    // 1. start web server
    const server = new Server(this)
    server.listen()

    // 2. start Protocol for each equipments
    this.config.south.equipments.forEach((equipment) => {
      const { protocol, enabled, equipmentId } = equipment
      // select the correct Handler
      const ProtocolHandler = protocolList[protocol]
      if (enabled) {
        if (ProtocolHandler) {
          this.activeProtocols[equipmentId] = new ProtocolHandler(equipment, this)
          this.activeProtocols[equipmentId].connect()
        } else {
          throw new Error(`Protocol for ${equipmentId} is not supported : ${protocol}`)
        }
      }
    })

    // 3. start Applications
    this.config.north.applications.forEach((application) => {
      const { api, enabled, applicationId } = application
      // select the right api handler
      const ApiHandler = apiList[api]
      if (enabled) {
        if (ApiHandler) {
          this.activeApis[applicationId] = new ApiHandler(api, this)
          this.activeApis[applicationId].connect()
        } else {
          throw new Error(`API for ${applicationId} is not supported : ${api}`)
        }
      }
    })

    // 4. start the timers for each scan modes
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => {
          // on each scan, activate each protocols
          this.scanModes[scanMode].forEach((equipmentId) => {
            this.activeProtocols[equipmentId].onScan(scanMode)
          })
        },
        start: false,
      })
      job.start()
    })

    if (callback) callback()
  }
}

module.exports = Engine
