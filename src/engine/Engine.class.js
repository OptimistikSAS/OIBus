const timexe = require('timexe')
const { EventEmitter } = require('events')

const { tryReadFile } = require('../services/config.service')
const VERSION = require('../../package.json').version

// South classes
const protocolList = {}
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA = require('../south/OPCUA/OPCUA.class')
protocolList.CSV = require('../south/CSV/CSV.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.FT = require('../south/FileTransmitter/FIleTransmitter.class')

// North classes
const apiList = {}
apiList.Console = require('../north/console/Console.class')
apiList.InfluxDB = require('../north/influxdb/InfluxDB.class')
apiList.TimescaleDB = require('../north/timescaledb/TimescaleDB.class')
apiList.FilePoster = require('../north/filePoster/FilePoster.class')

// Engine classes
const Server = require('../server/Server.class')
const Logger = require('./Logger.class')

const checkConfig = (config) => {
  const mandatoryEntries = ['engine.scanModes', 'engine.port', 'engine.user', 'engine.password', 'south.equipments', 'north.applications']

  // If the engine works normally as client
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
 * - allows to manage the bus for every EventEmitter of protocol and EventListener of application.
 */
class Engine {
  /**
   * Constructor for Engine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and equipments.
   * @constructor
   * @param {String} configFile - path to the config file
   * @return {Object} readConfig - parsed config Object
   */
  constructor(configFile) {
    this.config = tryReadFile(configFile)
    checkConfig(this.config)

    // Configure and get the logger
    this.logger = new Logger(this.config.engine.logParameters)

    // Get the emitter of events
    this.bus = new EventEmitter()

    // prepare config
    // initialize the scanLists with empty arrays
    this.scanLists = {}
    this.config.engine.scanModes.forEach(({ scanMode }) => {
      this.scanLists[scanMode] = []
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
          if (this.scanLists[point.scanMode] && !this.scanLists[point.scanMode].includes(equipment.equipmentId)) {
            this.scanLists[point.scanMode].push(equipment.equipmentId)
          }
        }
      })
    })

    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
  }

  /**
   * send a Value from an equipment to application by emitting an event, the value is made
   * of the id of the point (object), the value of the point (object) and a timestamp
   * (UTC).
   * @param {Object} value - New value (pointId, timestamp and data of the entry)
   * @return {void}
   */
  addValue({ pointId, data, timestamp }) {
    this.bus.emit('addValue', {
      pointId,
      timestamp,
      data,
    })
  }

  /**
   * Emit the event postFile
   * @param {*} file: The absolute address
   * @memberof Engine
   * @return {void}
   */
  postFile(file) {
    this.bus.emit('postFile', file)
  }

  /**
   * Register the callback function to the event listener
   * @param {String} eventName - The name of the event
   * @param {Function} callback - The callback function
   * @return {void}
   * @memberof Engine
   */
  register(eventName, callback) {
    this.bus.on(eventName, (args) => {
      callback(args)
    })
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @return {void}
   */
  start() {
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
    this.pointApplication = {}
    this.config.north.applications.forEach((application) => {
      const { api, enabled, applicationId } = application
      // select the right api handler
      const ApiHandler = apiList[api]
      if (enabled) {
        if (ApiHandler) {
          this.activeApis[applicationId] = new ApiHandler(application, this)
          this.activeApis[applicationId].connect()
        } else {
          throw new Error(`API for ${applicationId} is not supported : ${api}`)
        }
      }
    })

    // 4. start the timers for each scan modes
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = timexe(cronTime, () => {
        // on each scan, activate each protocols
        this.scanLists[scanMode].forEach((equipmentId) => {
          this.activeProtocols[equipmentId].onScan(scanMode)
        })
      })
      if (job.result !== 'ok') {
        throw new Error(`The scan  ${scanMode} could not start : ${job.error}`)
      }
    })
    this.logger.info(`fTbus version ${VERSION} started`)
  }
}

module.exports = Engine
