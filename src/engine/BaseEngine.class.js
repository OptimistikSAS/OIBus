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
protocolList.OPCUA_HA = require('../south/OPCUA/OPCUA_HA/OPCUA_HA.class')
protocolList.OPCUA_DA = require('../south/OPCUA/OPCUA_DA/OPCUA_DA.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.ADS = require('../south/ADS/ADS.class')
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCHDA = require('../south/OPCHDA/OPCHDA.class')
protocolList.RestApi = require('../south/RestApi/RestApi.class')

// BaseEngine classes
const Logger = require('./logger/Logger.class')
const { createRequestService } = require('../services/request')

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class BaseEngine
 */
class BaseEngine {
  /**
   * Constructor for BaseEngine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {ConfigService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   */
  constructor(configService, encryptionService) {
    this.version = VERSION

    this.eventEmitters = {}
    this.statusData = {}

    this.configService = configService
    this.encryptionService = encryptionService
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {object} engineConfig - the config retrieved from the file
   * @param {string} loggerScope - the scope used in the logger (for example 'OIBusEngine')
   * @returns {Promise<void>} - The promise returns when the services are set
   */
  async initEngineServices(engineConfig, loggerScope) {
    // Configure the logger
    this.logger = new Logger(loggerScope)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(engineConfig, {})

    // Request service
    this.requestService = createRequestService(this)
  }

  /**
   * Add a new Value from a data source to the BaseEngine.
   * The BaseEngine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(dataSourceId, values) {
    this.logger.warn(`addValues() should be surcharged ${dataSourceId} ${values}`)
  }

  /**
   * Add a new File from an data source to the BaseEngine.
   * The BaseEngine will forward the File to the Cache.
   * @param {string} dataSourceId - The South generating the file
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(dataSourceId, filePath, preserveFiles) {
    this.logger.warn(`addFile() should be surcharged ${dataSourceId} ${filePath} ${preserveFiles}`)
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   *
   * @param {boolean} safeMode - Whether to start in safe mode
   * @return {void}
   */
  async start(safeMode = false) {
    this.logger.warn(`start() should be surcharged ${safeMode}`)
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    this.logger.warn('stop() should be surcharged')
  }

  /**
   * Restart BaseEngine.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  async reload(timeout) {
    this.logger.warn(`reload() should be surcharged ${timeout}`)
  }

  /**
   * Shutdown OIbus.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  async shutdown(timeout) {
    this.logger.warn(`shutdown() should be surcharged ${timeout}`)
  }

  /**
    * Get OIBus version
    * @returns {string} - The OIBus version
    */
  getVersion() {
    return this.version
  }

  /**
   * Get cache folder
   * @return {string} - The cache folder
   */
  getCacheFolder() {
    this.logger.warn('getCacheFolder() should be surcharged')
  }

  /**
   * Create a new South instance
   *
   * @param {string} protocol - The protocol
   * @param {object} dataSource - The data source
   * @returns {ProtocolHandler|null} - The South
   */
  createSouth(protocol, dataSource) {
    const SouthHandler = protocolList[protocol]
    if (SouthHandler) {
      return new SouthHandler(dataSource, this)
    }
    return null
  }

  /**
   * Return available South protocols
   * @return {Object} - Available South protocols
   */
  // eslint-disable-next-line class-methods-use-this
  getSouthEngineList() {
    return protocolList
  }

  /**
   * Return the South class
   *
   * @param {string} api - The api
   * @param {object} application - The application
   * @returns {ProtocolHandler|null} - The South
   */
  createNorth(api, application) {
    const NorthHandler = apiList[api]
    if (NorthHandler) {
      return new NorthHandler(application, this)
    }
    return null
  }

  /**
   * Return available North applications
   * @return {Object} - Available North applications
   */
  // eslint-disable-next-line class-methods-use-this
  getNorthEngineList() {
    return apiList
  }
}

module.exports = BaseEngine
