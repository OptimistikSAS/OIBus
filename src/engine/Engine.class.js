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
    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
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
          console.error(`Protocol for ${equipmentId} is not supported : ${protocol}`)
          process.exit(1)
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
          console.error(`API for ${applicationId} is not supported : ${api}`)
          process.exit(1)
        }
      }
    })

    // 4. start the timers for each scan modes
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      if (scanMode === 'listen') {
        // If the scan mode is 'event'
        Object.values(this.activeProtocols).forEach((protocol) => {
          if (protocol.equipment.defaultScanMode === 'listen') {
            protocol.listen()
          }
        })
      } else {
        // If the scan mode is a normal one
        const job = new CronJob({
          cronTime,
          onTick: () => {
            // on each scan, activate each protocols
            Object.values(this.activeProtocols).forEach((protocol) => {
              protocol.onScan(scanMode)
            })
          },
          start: false,
        })
        job.start()
      }
    })

    if (callback) callback()
  }
}

module.exports = Engine
