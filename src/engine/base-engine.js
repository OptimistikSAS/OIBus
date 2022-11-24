const path = require('node:path')

const VERSION = require('../../package.json').version

const northList = {}
northList.OIAnalytics = require('../north/north-oianalytics/north-oianalytics')
northList.OIConnect = require('../north/north-oiconnect/north-oiconnect')
northList.FileWriter = require('../north/north-file-writer/north-file-writer')
northList.AmazonS3 = require('../north/north-amazon-s3/north-amazon-s3')
northList.InfluxDB = require('../north/north-influx-db/north-influx-db')
northList.TimescaleDB = require('../north/north-timescale-db/north-timescale-db')
northList.MongoDB = require('../north/north-mongo-db/north-mongo-db')
northList.MQTT = require('../north/north-mqtt/north-mqtt')
northList.Console = require('../north/north-console/north-console')
northList.WATSYConnect = require('../north/north-watsy/north-watsy')
northList.CsvToHttp = require('../north/north-csv-to-http/north-csv-to-http')

const southList = {}
southList.SQL = require('../south/south-sql/south-sql')
southList.FolderScanner = require('../south/south-folder-scanner/south-folder-scanner')
southList.OPCUA_HA = require('../south/south-opcua-ha/south-opcua-ha')
southList.OPCUA_DA = require('../south/south-opcua-da/south-opcua-da')
southList.MQTT = require('../south/south-mqtt/south-mqtt')
southList.ADS = require('../south/south-ads/south-ads')
southList.Modbus = require('../south/south-modbus/south-modbus')
southList.OPCHDA = require('../south/south-opchda/south-opchda')
southList.RestApi = require('../south/south-rest/south-rest')

const StatusService = require('../service/status.service')

/**
 * Abstract class used to manage North and South connectors
 * @class BaseEngine
 */
class BaseEngine {
  /**
   * Constructor for BaseEngine
   * @constructor
   * @param {ConfigurationService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {LoggerService} loggerService - The logger service
   * @param {String} cacheFolder - The base cache folder used by the engine and its connectors
   * @return {void}
   */
  constructor(
    configService,
    encryptionService,
    loggerService,
    cacheFolder,
  ) {
    this.version = VERSION
    this.cacheFolder = path.resolve(cacheFolder)

    this.installedNorthConnectors = northList
    this.installedSouthConnectors = southList

    this.configService = configService
    this.encryptionService = encryptionService
    this.loggerService = loggerService

    // Variable initialized in initEngineServices
    this.statusService = null
    this.logger = null
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {Object} engineConfig - the config retrieved from the file
   * @returns {Promise<void>} - The result promise
   */
  async initEngineServices(engineConfig) {
    this.oibusName = engineConfig.name
    this.defaultLogParameters = engineConfig.logParameters
    this.proxies = engineConfig.proxies
    this.statusService = new StatusService()
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   * @param {String} southId - The South connector id
   * @param {Object[]} values - Array of values
   * @returns {Promise<void>} - The result promise
   */
  async addValues(southId, values) {
    this.logger.warn(`addValues() should be surcharged. Called with South "${southId}" and ${values.length} values.`)
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
   * @param {Object} configuration - The South connector configuration
   * @param {Object} logger - The logger to use
   * @returns {SouthConnector|null} - The South connector
   */
  createSouth(configuration, logger) {
    try {
      const SouthConnector = this.installedSouthConnectors[configuration.type]
      if (SouthConnector) {
        return new SouthConnector(configuration, this.addValues.bind(this), this.addFile.bind(this), logger)
      }
      this.logger.error(`South connector for "${configuration.name}" is not found: ${configuration.type}`)
    } catch (error) {
      this.logger.error(`Error when creating South connector "${configuration.name}": ${error}`)
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
   * @param {Object} configuration - The North connector configuration
   * @param {Object} logger - The logger to use
   * @returns {NorthConnector|null} - The North connector
   */
  createNorth(configuration, logger) {
    try {
      const NorthConnector = this.installedNorthConnectors[configuration.type]
      if (NorthConnector) {
        return new NorthConnector(configuration, this.proxies, logger)
      }
      this.logger.error(`North connector for "${configuration.name}" is not found: ${configuration.type}`)
    } catch (error) {
      this.logger.error(`Error when creating North connector "${configuration.name}": ${error}`)
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
