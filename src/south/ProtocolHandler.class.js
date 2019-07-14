/**
 * Class Protocol : provides general attributes and methods for protocols.
 * Building a new South Protocol means to extend this class, and to surcharge
 * the following methods:
 * - handleValues: receive an array of values that need to be sent to an external applications
 * - handleFile: receive a file that need to be sent to an external application.
 * - connect: to allow to establish proper connection to the equipment(optional)
 * - disconnect: to allow proper disconnection (optional)
 * In addition, it is possible to use a number of helper functions:
 * - getProxy: get the proxy handler
 * - decryptPassword: to decrypt a password
 * - logger: to log an event with different levels (error,warning,info,debug)
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
    this.logger = engine.logger
    this.decryptPassword = this.engine.decryptPassword
  }

  connect() {
    const { dataSourceId, protocol } = this.dataSource
    this.logger.info(`Data source ${dataSourceId} started with protocol ${protocol}`)
  }

  onScan() {
    const { dataSourceId } = this.dataSource
    this.logger.error(`Data source ${dataSourceId} should surcharge onScan()`)
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
}

module.exports = ProtocolHandler
