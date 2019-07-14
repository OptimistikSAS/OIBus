const timexe = require('timexe')
const path = require('path')

const { tryReadFile, backupConfigFile, saveNewConfig } = require('../services/config.service')
const encryptionService = require('../services/encryption.service')
const VERSION = require('../../package.json').version

// South classes
const protocolList = {}
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA = require('../south/OPCUA/OPCUA.class')
protocolList.CSV = require('../south/CSV/CSV.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.RawFile = require('../south/RawFile/RawFile.class')
protocolList.SQLFile = require('../south/SQLFile/SQLFile.class')
protocolList.OPCHDA = require('../south/OPCHDA/OPCHDA.class')

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
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class Engine
 */
class Engine {
  /**
   * Constructor for Engine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {String} configFile - path to the config file
   * @return {Object} readConfig - parsed config Object
   */
  constructor(configFile) {
    this.configFile = path.resolve(configFile)
    this.config = tryReadFile(this.configFile)
    this.modifiedConfig = JSON.parse(JSON.stringify(this.config))

    // Configure and get the logger
    this.logger = new Logger(this.config.engine.logParameters)
    // Configure the Cache
    this.cache = new Cache(this)
    this.logger.info(`
    Starting Engine ${VERSION}
    architecture: ${process.arch}
    This platform is ${process.platform}
    Current directory: ${process.cwd()}
    Version Node: ${process.version}
    cache folder: ${path.resolve(this.config.engine.caching.cacheFolder)}`)
    // Check for private key
    this.keyFolder = path.join(this.config.engine.caching.cacheFolder, 'keys')
    encryptionService.checkOrCreatePrivateKey(this.keyFolder, this.logger)

    // prepare config
    // Associate the scanMode to all it's corresponding data sources
    // so the engine will know which datasource to activate when a
    // scanMode has a tick.

    // initialize the scanLists with empty arrays
    this.scanLists = {}
    this.config.engine.scanModes.forEach(({ scanMode }) => {
      this.scanLists[scanMode] = []
    })

    // browse config file for the various dataSource and points
    this.config.south.dataSources.forEach((dataSource) => {
      if (dataSource.enabled) {
        if (dataSource.scanMode) {
          if (!this.scanLists[dataSource.scanMode]) {
            this.logger.error(` dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${dataSource.scanMode}`)
          } else if (!this.scanLists[dataSource.scanMode].includes(dataSource.dataSourceId)) {
            // add the source for this scan only if not already there
            this.scanLists[dataSource.scanMode].push(dataSource.dataSourceId)
          }
        } else {
          dataSource.points.forEach((point) => {
            if (!this.scanLists[point.scanMode]) {
              this.logger.error(` point: ${point.pointId} in dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${point.scanMode}`)
            } else if (!this.scanLists[point.scanMode].includes(dataSource.dataSourceId)) {
              // add the source for this scan only if not already there
              this.scanLists[point.scanMode].push(dataSource.dataSourceId)
            }
          })
        }
      }
    })

    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
    this.jobs = []
  }

  /**
   * Add a new Value from an data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  addValue(dataSourceId, { pointId, data, timestamp }, doNotGroup) {
    this.cache.cacheValues(dataSourceId, { pointId, data, timestamp }, doNotGroup)
  }

  /**
   * Add an array of Values from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  addValues(dataSourceId, values, doNotGroup) {
    values.forEach(({ pointId, data, timestamp }) => {
      this.cache.cacheValues(dataSourceId, { pointId, data, timestamp }, doNotGroup)
    })
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} dataSourceId - The South generating the file
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(dataSourceId, filePath, preserveFiles) {
    this.cache.cacheFile(dataSourceId, filePath, preserveFiles)
  }

  /**
   * Send values to a North application.
   * @param {string} applicationId - The application ID
   * @param {object[]} values - The values to send
   * @return {Promise} - The send promise
   */
  async sendValues(applicationId, values) {
    let success = false
    try {
      success = await this.activeApis[applicationId].handleValues(values)
    } catch (error) {
      this.logger.error(error)
    }
    return success
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
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @return {void}
   */
  start() {
    // 1. start web server
    const server = new Server(this)
    server.listen()

    // 2. start Protocol for each data sources
    this.config.south.dataSources.forEach((dataSource) => {
      const { protocol, enabled, dataSourceId } = dataSource
      // select the correct Handler
      const ProtocolHandler = protocolList[protocol]
      if (enabled) {
        if (ProtocolHandler) {
          this.activeProtocols[dataSourceId] = new ProtocolHandler(dataSource, this)
          this.activeProtocols[dataSourceId].connect()
        } else {
          this.logger.error(`Protocol for ${dataSourceId} is not found : ${protocol}`)
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
          this.logger.error(`API for ${applicationId} is not found : ${api}`)
        }
      }
    })

    // 4. Initiate the cache
    this.cache.initialize(this.activeApis)

    // 5. start the timers for each scan modes
    this.config.engine.scanModes.forEach(({ scanMode, cronTime }) => {
      if (scanMode !== 'listen') {
        const job = timexe(cronTime, () => {
          // on each scan, activate each protocols
          this.scanLists[scanMode].forEach((dataSourceId) => {
            this.activeProtocols[dataSourceId].onScan(scanMode)
          })
        })
        if (job.result !== 'ok') {
          this.logger.error(`The scan  ${scanMode} could not start : ${job.error}`)
        } else {
          this.jobs.push(job.id)
        }
      }
    })
    this.logger.info('OIBus started')
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
    Object.entries(this.activeProtocols).forEach(([dataSourceId, protocol]) => {
      this.logger.info(`Stopping ${dataSourceId}`)
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
   * Get active configuration.
   * @returns {object} - The active configuration
   */
  getActiveConfiguration() {
    const config = JSON.parse(JSON.stringify(this.config))
    encryptionService.decryptSecrets(config.engine.proxies, this.keyFolder, this.logger)
    encryptionService.decryptSecrets(config.north.applications, this.keyFolder, this.logger)
    encryptionService.decryptSecrets(config.south.dataSources, this.keyFolder, this.logger)
    return config
  }

  /**
   * Get active configuration.
   * @returns {object} - The active configuration
   */
  getModifiedConfiguration() {
    const config = JSON.parse(JSON.stringify(this.modifiedConfig))
    encryptionService.decryptSecrets(config.engine.proxies, this.keyFolder, this.logger)
    encryptionService.decryptSecrets(config.north.applications, this.keyFolder, this.logger)
    encryptionService.decryptSecrets(config.south.dataSources, this.keyFolder, this.logger)
    return config
  }

  /**
   * Check if the given application ID already exists
   * @param {string} applicationId - The application ID to check
   * @returns {object | undefined} - Whether the given application exists
   */
  hasNorth(applicationId) {
    return this.modifiedConfig.north.applications.find(application => application.applicationId === applicationId)
  }

  /**
   * Add North application
   * @param {object} application - The new application to add
   * @returns {void}
   */
  addNorth(application) {
    encryptionService.encryptSecrets(application, this.keyFolder)
    this.modifiedConfig.north.applications.push(application)
  }

  /**
   * Update North application
   * @param {object} application - The updated application
   * @returns {void}
   */
  updateNorth(application) {
    const index = this.modifiedConfig.north.applications.findIndex(element => element.applicationId === application.applicationId)
    if (index > -1) {
      encryptionService.encryptSecrets(application, this.keyFolder)
      this.modifiedConfig.north.applications[index] = application
    }
  }

  /**
   * Delete North application
   * @param {string} applicationId - The application to delete
   * @returns {void}
   */
  deleteNorth(applicationId) {
    this.modifiedConfig.north.applications = this.modifiedConfig.north.applications.filter(application => application.applicationId !== applicationId)
  }

  /**
   * Check if the given data source ID already exists
   * @param {string} dataSourceId - The data source ID to check
   * @returns {object | undefined} - Whether the given data source exists
   */
  hasSouth(dataSourceId) {
    return this.modifiedConfig.south.dataSources.find(dataSource => dataSource.dataSourceId === dataSourceId)
  }

  /**
   * Add South data source
   * @param {object} dataSource - The new data source to add
   * @returns {void}
   */
  addSouth(dataSource) {
    encryptionService.encryptSecrets(dataSource, this.keyFolder)
    this.modifiedConfig.south.dataSources.push(dataSource)
  }

  /**
   * Update South data source
   * @param {object} dataSource - The updated data source
   * @returns {void}
   */
  updateSouth(dataSource) {
    const index = this.modifiedConfig.south.dataSources.findIndex(element => element.dataSourceId === dataSource.dataSourceId)
    if (index > -1) {
      encryptionService.encryptSecrets(dataSource, this.keyFolder)
      this.modifiedConfig.south.dataSources[index] = dataSource
    }
  }

  /**
   * Delete South data source
   * @param {string} dataSourceId - The data source to delete
   * @returns {void}
   */
  deleteSouth(dataSourceId) {
    this.modifiedConfig.south.dataSources = this.modifiedConfig.south.dataSources.filter(dataSource => dataSource.dataSourceId !== dataSourceId)
  }

  /**
   * Update Engine
   * @param {object} engine - The updated Engine
   * @returns {void}
   */
  updateEngine(engine) {
    encryptionService.encryptSecrets(engine.proxies, this.keyFolder)
    this.modifiedConfig.engine = engine
  }

  /**
   * Get points for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @returns {object} - The points
   */
  getPointsForSouth(dataSourceId) {
    const dataSource = this.modifiedConfig.south.dataSources.find(elem => elem.dataSourceId === dataSourceId)

    if (dataSource && dataSource.points) {
      return dataSource.points
    }

    return {}
  }

  /**
   * Check whether the given South already has a point with the given point ID.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point ID
   * @returns {boolean} - Whether the given South has a point with the given point ID
   */
  hasSouthPoint(dataSourceId, pointId) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)

    if (dataSource && dataSource.points) {
      return dataSource.points.find(elem => elem.pointId === pointId)
    }

    return false
  }

  /**
   * Add new point for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {object} point - The point to add
   * @returns {void}
   */
  addSouthPoint(dataSourceId, point) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      dataSource.points.push(point)
    }
  }

  /**
   * Update point for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point to update
   * @param {object} point - The updated point
   * @returns {void}
   */
  updateSouthPoint(dataSourceId, pointId, point) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      const index = dataSource.points.findIndex(element => element.pointId === pointId)
      if (index > -1) {
        dataSource.points[index] = point
      }
    }
  }

  /**
   * Delete point from a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point ID to delete
   * @returns {void}
   */
  deleteSouthPoint(dataSourceId, pointId) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      dataSource.points = dataSource.points.filter(point => point.pointId !== pointId)
    }
  }

  /**
   * Delete all points from a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @returns {void}
   */
  deleteSouthPoints(dataSourceId) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      dataSource.points = []
    }
  }

  /**
   * Set points for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {object[]} points - The points to set
   * @returns {void}
   */
  setSouthPoints(dataSourceId, points) {
    const dataSource = this.modifiedConfig.south.dataSources.find(element => element.dataSourceId === dataSourceId)
    if (dataSource) {
      dataSource.points = points
    }
  }

  /**
   * Activate the configuration
   * @returns {void}
   */
  activateConfiguration() {
    backupConfigFile(this.configFile)
    saveNewConfig(this.modifiedConfig, this.configFile)
    this.reload(100)
  }

  /**
   * Reset configuration
   * @returns {void}
   */
  resetConfiguration() {
    this.modifiedConfig = tryReadFile(this.configFile)
  }
}

module.exports = Engine
