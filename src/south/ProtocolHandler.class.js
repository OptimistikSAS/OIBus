const fs = require('fs')
const zlib = require('zlib')

const EncryptionService = require('../services/EncryptionService.class')
const databaseService = require('../services/database.service')
const Logger = require('../engine/Logger.class')

/**
 * Class Protocol : provides general attributes and methods for protocols.
 * Building a new South Protocol means to extend this class, and to surcharge
 * the following methods:
 * - **onScan**: will be called by the engine each time a scanMode is scheduled. it receive the "scanmode" name.
 * so the driver will be able to look at **this.dataSource** that contains all parameters for this
 * dataSource including the points to be queried, the informations to connect to the data source, etc.... It's up to
 * the driver to decide if additional structure (such as scanGroups for OPCHDA) need to be initialized in the
 * constructor to simplify or optimize the onScan method.
 * - **listen**: A special scanMode can be created for a protocol (for example MQTT). In this configuration, the
 * driver will be able to "listen" for updated values.
 * - **connect**: to allow to establish proper connection to the data source(optional)
 * - **disconnect**: to allow proper disconnection (optional)
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** mmethod to be used in **onScan** or **Listen**. This will allow to push an array
 * of values
 * - **addFile**: is the equivalent of addValues but for a file.
 * to the OIBus engine. More details on the Engine class.
 * - **logger**: to log an event with different levels (error,warning,info,debug)
 *
 * All other operations (cache, store&forward, communication to North applications) will be
 * handled by the OIBus engine and should not be taken care at the South level.
 *
 */
class ProtocolHandler {
  /**
   * Constructor for Protocol
   * @constructor
   * @param {*} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    this.dataSource = dataSource
    this.engine = engine
    this.encryptionService = EncryptionService.getInstance()
    this.compressionLevel = 9
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig

    const { logParameters } = this.dataSource
    this.logger = new Logger()
    this.logger.changeParameters(this.engineConfig.logParameters, logParameters)
  }

  async connect() {
    const { dataSourceId, protocol } = this.dataSource
    const databasePath = `${this.engineConfig.caching.cacheFolder}/${dataSourceId}.db`
    this.configDatabase = await databaseService.createConfigDatabase(databasePath)
    this.logger.info(`Data source ${dataSourceId} started with protocol ${protocol}`)
  }

  onScan(scanMode) {
    const { dataSourceId } = this.dataSource
    this.logger.error(`Data source ${dataSourceId} should surcharge onScan(${scanMode})`)
  }

  listen() {
    const { dataSourceId } = this.dataSource
    this.logger.error(`Data source ${dataSourceId} should surcharge listen()`)
  }

  disconnect() {
    const { dataSourceId } = this.dataSource
    this.logger.info(`Data source ${dataSourceId} disconnected`)
  }

  /**
   * Add a new Value to the Engine.
   * @param {array} values - The new value
   * @return {void}
   */
  addValues(values) {
    this.engine.addValues(this.dataSource.dataSourceId, values)
  }

  /**
   * Add a new File to the Engine.
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the original file
   * @return {void}
   */
  addFile(filePath, preserveFiles) {
    this.engine.addFile(this.dataSource.dataSourceId, filePath, preserveFiles)
  }

  /**
   * Compress the specified file
   * @param {string} input - The path of the file to compress
   * @param {string} output - The path to the compressed file
   * @returns {Promise} - The compression result
   */
  compress(input, output) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(input)
      const writeStream = fs.createWriteStream(output)
      const gzip = zlib.createGzip({ level: this.compressionLevel })
      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error)
        })
        .on('finish', () => {
          resolve()
        })
    })
  }

  /**
   * Read a given key in the config db of the protocol handler
   * @param {string} configKey - key to retrieve
   * @returns {Promise} - The value of the key
   */

  async getConfigDb(configKey) {
    return databaseService.getConfig(this.configDatabase, configKey)
  }

  /**
   * Update or add a given key in the config db of the protocol handler
   * @param {string} configKey - key to update/add
   * @param {string} value - value of the key
   * @returns {Promise} - the value to update the key
   */

  async upsertConfigDb(configKey, value) {
    return databaseService.upsertConfig(
      this.configDatabase,
      configKey,
      value,
    )
  }

  /**
   * Decompress the specified file
   * @param {string} input - The path of the compressed file
   * @param {string} output - The path to the decompressed file
   * @returns {Promise} - The decompression result
   */
  /* eslint-disable-next-line class-methods-use-this */
  decompress(input, output) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(input)
      const writeStream = fs.createWriteStream(output)
      const gunzip = zlib.createGunzip()
      readStream
        .pipe(gunzip)
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error)
        })
        .on('finish', () => {
          resolve()
        })
    })
  }
}

module.exports = ProtocolHandler
