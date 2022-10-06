const path = require('node:path')

const VERSION = require('../../package.json').version

const apiList = {}
apiList.OIAnalytics = require('../north/OIAnalytics/OIAnalytics.class')
apiList.OIConnect = require('../north/OIConnect/OIConnect.class')
apiList.FileWriter = require('../north/FileWriter/FileWriter.class')
apiList.AmazonS3 = require('../north/AmazonS3/AmazonS3.class')
apiList.InfluxDB = require('../north/InfluxDB/InfluxDB.class')
apiList.TimescaleDB = require('../north/TimescaleDB/TimescaleDB.class')
apiList.MongoDB = require('../north/MongoDB/MongoDB.class')
apiList.MQTT = require('../north/MQTT/MQTT.class')
apiList.Console = require('../north/Console/Console.class')
apiList.WATSYConnect = require('../north/WATSYConnect/WATSYConnect.class')
apiList.CsvToHttp = require('../north/CsvToHttp/CsvToHttp.class')

const protocolList = {}
protocolList.SQL = require('../south/SQL/SQL.class')
protocolList.FolderScanner = require('../south/FolderScanner/FolderScanner.class')
protocolList.OPCUA_HA = require('../south/OPCUA_HA/OPCUA_HA.class')
protocolList.OPCUA_DA = require('../south/OPCUA_DA/OPCUA_DA.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.ADS = require('../south/ADS/ADS.class')
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCHDA = require('../south/OPCHDA/OPCHDA.class')
protocolList.RestApi = require('../south/RestApi/RestApi.class')

const Logger = require('./logger/Logger.class')
const { createRequestService } = require('../services/request')
const StatusService = require('../services/status.service.class')

/**
 * Abstract class used to manage North and South connectors
 * @class BaseEngine
 */
class BaseEngine {
  /**
   * Constructor for BaseEngine
   * @constructor
   * @param {ConfigService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {String} cacheFolder - The base cache folder used by the engine and its connectors
   * @return {void}
   */
  constructor(configService, encryptionService, cacheFolder) {
    this.version = VERSION
    this.cacheFolder = path.resolve(cacheFolder)

    this.installedNorthConnectors = apiList
    this.installedSouthConnectors = protocolList

    this.configService = configService
    this.encryptionService = encryptionService

    // Variable initialized in initEngineServices
    this.statusService = null
    this.logger = null
    this.requestService = null
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {Object} engineConfig - the config retrieved from the file
   * @param {String} loggerScope - the scope used in the logger (for example 'OIBusEngine')
   * @returns {Promise<void>} - The result promise
   */
  async initEngineServices(engineConfig, loggerScope) {
    this.statusService = new StatusService()
    // Configure the logger
    this.logger = new Logger(loggerScope)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(engineConfig, {})

    // Buffer delay in ms: when a South connector generates a lot of values at the same time, it may be better to accumulate them
    // in a buffer before sending them to the engine
    // Max buffer: if the buffer reaches this length, it will be sent to the engine immediately
    // these parameters could be settings from OIBus UI
    this.bufferMax = engineConfig.caching.bufferMax
    this.bufferTimeoutInterval = engineConfig.caching.bufferTimeoutInterval

    // Request service
    this.requestService = createRequestService(this)
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   * @param {String} id - The South connector id
   * @param {Object[]} values - Array of values
   * @returns {Promise<void>} - The result promise
   */
  async addValues(id, values) {
    this.logger.warn(`addValues() should be surcharged. Called with South "${id}" and ${values.length} values.`)
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   * @param {String} id - The South connector id
   * @param {String} filePath - The path to the file
   * @param {Boolean} preserveFiles - Whether to preserve the file at the original location
   * @returns {Promise<void>} - The result promise
   */
  async addFile(id, filePath, preserveFiles) {
    this.logger.warn(`addFile() should be surcharged. Called with South "${id}", file "${filePath}" and ${preserveFiles}.`)
  }

  /**
   * Creates a new instance for every North and South connectors and initialize them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @param {Boolean} safeMode - Whether to start in safe mode
   * @returns {Promise<void>} - The result promise
   */
  async start(safeMode = false) {
    this.logger.warn(`start() should be surcharged. Called with safe mode ${safeMode}.`)
  }

  /**
   * Gracefully stop every timer, South and North connectors
   * @returns {Promise<void>} - The result promise
   */
  async stop() {
    this.logger.warn('stop() should be surcharged.')
  }

  /**
   * Return the South connector
   * @param {Object} southConfig - The South connector settings
   * @returns {SouthConnector|null} - The South connector
   */
  createSouth(southConfig) {
    try {
      const SouthConnector = this.installedSouthConnectors[southConfig.protocol]
      if (SouthConnector) {
        return new SouthConnector(southConfig, this)
      }
      this.logger.error(`South connector for "${southConfig.name}" is not found: ${southConfig.protocol}`)
    } catch (error) {
      this.logger.error(`Error when creating South connector "${southConfig.name}": ${error}`)
    }
    return null
  }

  /**
   * Return installed South connectors with their category and name
   * @return {Object[]} - Installed South connectors
   */
  getSouthList() {
    this.logger.debug('Getting installed South connectors list.')
    return Object.entries(this.installedSouthConnectors).map(([connectorName, { category }]) => ({
      connectorName,
      category,
    }))
  }

  /**
   * Return the North connector
   * @param {Object} settings - The North connector settings
   * @returns {NorthConnector|null} - The North connector
   */
  createNorth(settings) {
    try {
      const NorthConnector = this.installedNorthConnectors[settings.api]
      if (NorthConnector) {
        return new NorthConnector(settings, this)
      }
      this.logger.error(`North connector for "${settings.name}" is not found: ${settings.api}`)
    } catch (error) {
      this.logger.error(`Error when creating North connector "${settings.name}": ${error}`)
    }
    return null
  }

  /**
   * Return installed North connectors with their category and name
   * @return {Object[]} - Installed North connectors
   */
  getNorthList() {
    this.logger.debug('Getting installed North connectors list.')
    return Object.entries(this.installedNorthConnectors).map(([connectorName, { category }]) => ({
      connectorName,
      category,
    }))
  }
}

module.exports = BaseEngine
