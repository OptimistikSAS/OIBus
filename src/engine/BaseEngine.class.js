import fs from 'node:fs/promises'

// BaseEngine classes
import Logger from './logger/Logger.class.js'
import createRequestService from '../services/request/index.js'
import OIAnalytics from '../north/OIAnalytics/OIAnalytics.class.js'
import OIConnect from '../north/OIConnect/OIConnect.class.js'
import FileWriter from '../north/FileWriter/FileWriter.class.js'
import AmazonS3 from '../north/AmazonS3/AmazonS3.class.js'
import InfluxDB from '../north/InfluxDB/InfluxDB.class.js'
import TimescaleDB from '../north/TimescaleDB/TimescaleDB.class.js'
import MongoDB from '../north/MongoDB/MongoDB.class.js'
import MQTTNorth from '../north/MQTT/MQTT.class.js'
import Console from '../north/Console/Console.class.js'
import WATSYConnect from '../north/WATSYConnect/WATSYConnect.class.js'
import CsvToHttp from '../north/CsvToHttp/CsvToHttp.class.js'
import SQL from '../south/SQL/SQL.class.js'
import FolderScanner from '../south/FolderScanner/FolderScanner.class.js'
import OPCUA_HA from '../south/OPCUA/OPCUA_HA/OPCUA_HA.class.js'
import OPCUA_DA from '../south/OPCUA/OPCUA_DA/OPCUA_DA.class.js'
import MQTTSouth from '../south/MQTT/MQTT.class.js'
import ADS from '../south/ADS/ADS.class.js'
import Modbus from '../south/Modbus/Modbus.class.js'
import OPCHDA from '../south/OPCHDA/OPCHDA.class.js'
import RestApi from '../south/RestApi/RestApi.class.js'

const apiList = {}
apiList.OIAnalytics = OIAnalytics
apiList.OIConnect = OIConnect
apiList.FileWriter = FileWriter
apiList.AmazonS3 = AmazonS3
apiList.InfluxDB = InfluxDB
apiList.TimescaleDB = TimescaleDB
apiList.MongoDB = MongoDB
apiList.MQTT = MQTTNorth
apiList.Console = Console
apiList.WATSYConnect = WATSYConnect
apiList.CsvToHttp = CsvToHttp

const protocolList = {}
protocolList.SQL = SQL
protocolList.FolderScanner = FolderScanner
protocolList.OPCUA_HA = OPCUA_HA
protocolList.OPCUA_DA = OPCUA_DA
protocolList.MQTT = MQTTSouth
protocolList.ADS = ADS
protocolList.Modbus = Modbus
protocolList.OPCHDA = OPCHDA
protocolList.RestApi = RestApi

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class BaseEngine
 */
export default class BaseEngine {
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
    const packageJson = JSON.parse(await fs.readFile('package.json'))
    this.version = packageJson.version

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
