const timexe = require('timexe')
const path = require('path')

const { tryReadFile, backupConfigFile, saveNewConfig } = require('../services/config.service')
const VERSION = require('../../package.json').version

// South classes
const protocolList = {}
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA = require('../south/OPCUA/OPCUA.class')
protocolList.CSV = require('../south/CSV/CSV.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.RawFile = require('../south/RawFile/RawFile.class')

// North classes
const apiList = {}
apiList.Console = require('../north/console/Console.class')
apiList.InfluxDB = require('../north/influxdb/InfluxDB.class')
apiList.TimescaleDB = require('../north/timescaledb/TimescaleDB.class')
apiList.RawFileSender = require('../north/rawfilesender/RawFileSender.class')
apiList.AmazonS3 = require('../north/amazon/AmazonS3.class')
apiList.AliveSignal = require('../north/alivesignal/AliveSignal.class')

// Engine classes
const Server = require('../server/Server.class')
const Logger = require('./Logger.class')
const Cache = require('./Cache.class')

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
    this.configFile = path.resolve(configFile)
    this.config = tryReadFile(this.configFile)

    // Configure and get the logger
    this.logger = new Logger(this.config.engine.logParameters)

    // Configure the Cache
    this.cache = new Cache(this)

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
    this.jobs = []
  }

  /**
   * Add a new Value from an equipment to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  addValue({ pointId, data, timestamp }, doNotGroup) {
    this.cache.cacheValues({ pointId, data, timestamp }, doNotGroup)
  }

  /**
   * Add a new File from an equipment to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(filePath, preserveFiles) {
    this.cache.cacheFile(filePath, preserveFiles)
  }

  /**
   * Send values to a North application.
   * @param {string} applicationId - The application ID
   * @param {object[]} values - The values to send
   * @return {Promise} - The send promise
   */
  sendValues(applicationId, values) {
    return new Promise((resolve) => {
      this.activeApis[applicationId].handleValues(values)
        .then(() => {
          resolve(true)
        })
        .catch((error) => {
          this.logger.error(error)
          resolve(false)
        })
    })
  }

  /**
   * Send file to a North application.
   * @param {string} applicationId - The application ID
   * @param {string} filePath - The file to send
   * @return {Promise} - The send promise
   */
  async sendFile(applicationId, filePath) {
    let success = false

    try {
      success = await this.activeApis[applicationId].handleFile(filePath)
    } catch (error) {
      this.logger.error(error)
    }

    return success
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

    // 4. Initiate the cache
    this.cache.initialize(this.activeApis)

    // 5. start the timers for each scan modes
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = timexe(cronTime, () => {
        // on each scan, activate each protocols
        this.scanLists[scanMode].forEach((equipmentId) => {
          this.activeProtocols[equipmentId].onScan(scanMode)
        })
      })
      if (job.result !== 'ok') {
        throw new Error(`The scan  ${scanMode} could not start : ${job.error}`)
      } else {
        this.jobs.push(job.id)
      }
    })
    this.logger.info(`OIBus version ${VERSION} started`)
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {void}
   */
  stop() {
    // Stop timers
    this.jobs.forEach((id) => {
      timexe.remove(id)
    })

    // Stop Protocols
    Object.entries(this.activeProtocols).forEach(([equipmentId, protocol]) => {
      this.logger.info(`Stopping ${equipmentId}`)
      protocol.disconnect()
    })

    // Stop Applications
    Object.entries(this.activeApis).forEach(([applicationId, application]) => {
      this.logger.info(`Stopping ${applicationId}`)
      application.disconnect()
    })
  }

  /**
   * Restart Engine.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  reload(timeout) {
    this.stop()

    setTimeout(() => {
      process.exit(1)
    }, timeout)
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  getNorthSchemaList() {
    this.logger.debug('Getting North applications')

    return Object.keys(apiList)
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */
  getSouthSchemaList() {
    this.logger.debug('Getting South protocols')

    return Object.keys(protocolList)
  }

  /**
   * Get schema definition for the given api
   * @param {String} api - The api to get the schema for
   * @return {Object} - The api schema
   */
  getNorthSchema(api) {
    if (Object.keys(apiList).includes(api)) {
      this.logger.debug(`Getting schema for North application ${api}`)

      return apiList[api].schema
    }

    return null
  }

  /**
   * Get schema definition for the given protocol
   * @param {String} protocol - The protocol to get the schema for
   * @return {Object} - The protocol schema
   */
  getSouthSchema(protocol) {
    if (Object.keys(protocolList).includes(protocol)) {
      this.logger.debug(`Getting schema for South protocol ${protocol}`)

      return protocolList[protocol].schema
    }

    return null
  }

  /**
   * Check if the given application ID already exists
   * @param {string} applicationId - The application ID to check
   * @returns {object | undefined} - Whether the given application exists
   */
  hasNorth(applicationId) {
    return this.config.north.applications.find(application => application.applicationId === applicationId)
  }

  /**
   * Add North application
   * @param {object} application - The new application to add
   * @returns {void}
   */
  addNorth(application) {
    backupConfigFile(this.configFile)

    this.config.north.applications.push(application)

    saveNewConfig(this.config, this.configFile)

    this.reload(1000)
  }

  /**
   * Update North application
   * @param {object} application - The new application to add
   * @returns {void}
   */
  updateNorth(application) {
    const index = this.config.north.applications.findIndex(element => element.applicationId === application.applicationId)
    if (index > 0) {
      backupConfigFile(this.configFile)

      this.config.north.applications[index] = application

      saveNewConfig(this.config, this.configFile)

      this.reload(1000)
    }
  }

  /**
   * Delete North application
   * @param {string} applicationId - The application to delete
   * @returns {void}
   */
  deleteNorth(applicationId) {
    backupConfigFile(this.configFile)

    this.config.north.applications = this.config.north.applications.filter(application => application.applicationId !== applicationId)

    saveNewConfig(this.config, this.configFile)

    this.reload(1000)
  }
}

module.exports = Engine
