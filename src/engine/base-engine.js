import path from 'node:path'

// North imports
import OIAnalytics from '../north/north-oianalytics/north-oianalytics.js'
import OIConnect from '../north/north-oiconnect/north-oiconnect.js'
import FileWriter from '../north/north-file-writer/north-file-writer.js'
import AmazonS3 from '../north/north-amazon-s3/north-amazon-s3.js'
import InfluxDB from '../north/north-influx-db/north-influx-db.js'
import TimescaleDB from '../north/north-timescale-db/north-timescale-db.js'
import MongoDB from '../north/north-mongo-db/north-mongo-db.js'
import MQTTNorth from '../north/north-mqtt/north-mqtt.js'
import Console from '../north/north-console/north-console.js'
import WATSYConnect from '../north/north-watsy/north-watsy.js'
import CsvToHttp from '../north/north-csv-to-http/north-csv-to-http.js'

// South imports
import SQL from '../south/south-sql/south-sql.js'
import FolderScanner from '../south/south-folder-scanner/south-folder-scanner.js'
import OPCUA_HA from '../south/south-opcua-ha/south-opcua-ha.js'
import OPCUA_DA from '../south/south-opcua-da/south-opcua-da.js'
import MQTTSouth from '../south/south-mqtt/south-mqtt.js'
import ADS from '../south/south-ads/south-ads.js'
import Modbus from '../south/south-modbus/south-modbus.js'
import OPCHDA from '../south/south-opchda/south-opchda.js'
import RestApi from '../south/south-rest/south-rest.js'

import StatusService from '../service/status.service.js'

const northList = {
  OIAnalytics,
  OIConnect,
  FileWriter,
  AmazonS3,
  InfluxDB,
  TimescaleDB,
  MongoDB,
  MQTT: MQTTNorth,
  Console,
  WATSYConnect,
  CsvToHttp,
}

const southList = {
  SQL,
  FolderScanner,
  OPCUA_HA,
  OPCUA_DA,
  MQTT: MQTTSouth,
  ADS,
  Modbus,
  OPCHDA,
  RestApi,
}

/**
 * Abstract class used to manage North and South connectors
 * @class BaseEngine
 */
export default class BaseEngine {
  /**
   * Constructor for BaseEngine
   * @constructor
   * @param {String} version - The OIBus version
   * @param {ConfigurationService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {LoggerService} loggerService - The logger service
   * @param {String} cacheFolder - The base cache folder used by the engine and its connectors
   * @return {void}
   */
  constructor(
    version,
    configService,
    encryptionService,
    loggerService,
    cacheFolder,
  ) {
    this.version = version
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
