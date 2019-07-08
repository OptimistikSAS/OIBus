const encryptionService = require('../services/encryption.service')

/**
 * Class Protocol : provides general attributes and methods for protocols.
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
    this.logger = engine.logger
  }

  connect() {
    const { dataSourceId, protocol } = this.dataSource
    this.logger.info(`Data source ${dataSourceId} started with protocol ${protocol}`)
  }
  /* eslint-disable-next-line */
  onScan() {}
  /* eslint-disable-next-line */
  listen() {}

  disconnect() {
    const { dataSourceId } = this.dataSource
    this.logger.info(`Data source ${dataSourceId} disconnected`)
  }

  /**
   * Add a new Value to the Engine.
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  addValue({ pointId, data, timestamp }, doNotGroup) {
    this.engine.addValue(this.dataSource.dataSourceId, { data, timestamp, pointId }, doNotGroup)
  }

  /**
   * Add a new File to the Engine.
   * @param {string} filePath - The path to the File
   * @return {void}
   */
  addFile(filePath) {
    this.engine.addFile(this.dataSource.dataSourceId, filePath, this.preserveFiles)
  }

  /**
   * Decrypt password.
   * @param {string} password - The password to decrypt
   * @return {string} - The decrypted password
   */
  decryptPassword(password) {
    return encryptionService.decryptText(password, this.engine.keyFolder, this.logger)
  }
}

module.exports = ProtocolHandler
