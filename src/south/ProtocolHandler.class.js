const fs = require('fs')
const zlib = require('zlib')

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
 * - **decryptPassword**: to decrypt a password
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
    this.logger = new Logger(this.constructor.name)
    this.compressionLevel = 9
  }

  connect() {
    const { dataSourceId, protocol } = this.dataSource
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
   * Decrypt password.
   * @param {string} password - The password to decrypt
   * @returns {string} - The decrypted password
   */
  decryptPassword(password) {
    const decryptedPassword = this.engine.decryptPassword(password)
    if (decryptedPassword == null) {
      this.logger.error(`Error decrypting password for ${this.constructor.name}`)
    }
    return decryptedPassword || ''
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
}

module.exports = ProtocolHandler
