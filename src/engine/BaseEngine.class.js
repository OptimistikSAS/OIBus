const VERSION = require('../../package.json').version
// the generic class need to be imported to be used by extensions
global.NorthHandler = require('../north/NorthHandler.class')
global.SouthHandler = require('../south/SouthHandler.class')
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
    this.northSchemas = {}
    this.southSchemas = {}
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
    // load north modules
    await Promise.all(engineConfig.northModules.map(async (name) => {
      try {
        const extension = await import(`../north/${name}/${name}.class.js`)
        this.northSchemas[name] = extension.default
        this.logger.debug(`North ${name} is added`)
      } catch (error) {
        this.logger.error(`North ${name} can't be loaded ${error}`)
      }
    }))
    // load south modules
    await Promise.all(engineConfig.southModules.map(async (name) => {
      try {
        const extension = await import(`../south/${name}/${name}.class.js`)
        this.southSchemas[name] = extension.default
        this.logger.debug(`South ${name} is added`)
      } catch (error) {
        this.logger.error(`South ${name} can't be loaded ${error}`)
      }
    }))

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
   * @returns {SouthHandler|null} - The South
   */
  createSouth(protocol, dataSource) {
    const SouthHandler = this.southSchemas[protocol]
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
    return this.southSchemas
  }

  /**
   * Return the South class
   *
   * @param {string} api - The api
   * @param {object} application - The application
   * @returns {SouthHandler|null} - The South
   */
  createNorth(api, application) {
    const NorthHandler = this.northSchemas[api]
    if (NorthHandler) {
      return new NorthHandler(application, this)
    }
    return null
  }
}

module.exports = BaseEngine
