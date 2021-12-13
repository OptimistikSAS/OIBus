const VERSION = require('../../package.json').version

const apiList = {}
apiList.Console = require('../north/console/Console.class')
apiList.InfluxDB = require('../north/influxdb/InfluxDB.class')
apiList.TimescaleDB = require('../north/timescaledb/TimescaleDB.class')
apiList.OIAnalytics = require('../north/oianalytics/OIAnalytics.class')
apiList.AmazonS3 = require('../north/amazon/AmazonS3.class')
apiList.OIConnect = require('../north/oiconnect/OIConnect.class')
apiList.MongoDB = require('../north/mongodb/MongoDB.class')
apiList.MQTTNorth = require('../north/mqttnorth/MQTTNorth.class')
apiList.WATSYConnect = require('../north/watsyconnect/WATSYConnect.class')
apiList.CsvToHttp = require('../north/CsvToHttp/CsvToHttp.class')
apiList.FileWriter = require('../north/filewriter/FileWriter.class')

const protocolList = {}
protocolList.ADS = require('../south/ADS/ADS.class')
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA_HA = require('../south/OPCUA_HA/OPCUA_HA.class')
protocolList.OPCUA_DA = require('../south/OPCUA_DA/OPCUA_DA.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.SQLDbToFile = require('../south/SQLDbToFile/SQLDbToFile.class')
protocolList.FolderScanner = require('../south/FolderScanner/FolderScanner.class')
protocolList.OPCHDA = require('../south/OPCHDA/OPCHDA.class')

// BaseEngine classes
const ConfigService = require('../services/config.service.class')
const Logger = require('./Logger.class')
const EncryptionService = require('../services/EncryptionService.class')
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
   * @param {string} configFile - The config file
   */
  constructor(configFile) {
    this.version = VERSION

    this.configService = new ConfigService(this, configFile)
    const { engineConfig } = this.configService.getConfig()

    // Check for private key
    this.encryptionService = EncryptionService.getInstance()
    this.encryptionService.setKeyFolder(this.configService.keyFolder)
    this.encryptionService.checkOrCreatePrivateKey()

    // Configure the logger
    this.logger = Logger.getDefaultLogger()
    this.logger.setEncryptionService(this.encryptionService)
    this.logger.changeParameters(engineConfig, {})

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
  getSouthList() {
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
  getNorthList() {
    return apiList
  }
}

module.exports = BaseEngine
