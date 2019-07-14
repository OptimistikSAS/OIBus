const path = require('path')

class ApiHandler {
  /**
   * Constructor for Application
   * Building a new North API means to extend this class, and to surcharge
   * the following methods:
   * - handleValues: receive an array of values that need to be sent to an external applications
   * - handleFile: receive a file that need to be sent to an external application.
   * - connect: to allow to establish proper connection to the external application (optional)
   * - disconnect: to allow proper disconnection (optional)
   * In addition, it is possible to use a number of helper functions:
   * - getProxy: get the proxy handler
   * - decryptPassword: to decrypt a password
   * - logger: to log an event with different levels (error,warning,info,debug)
   *
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    this.canHandleValues = false
    this.canHandleFiles = false

    this.application = applicationParameters
    this.engine = engine
    this.logger = this.engine.logger
    this.config = this.engine.config
    this.scanModes = this.engine.scanModes
    this.decryptPassword = this.engine.decryptPassword
  }

  /**
   * Method called by Engine to initialize a given api. This method can be surcharged in the
   * North api implementation to allow connection to a third party application for example.
   * @return {void}
   */
  connect() {
    const { applicationId, api } = this.application
    this.logger.info(`North API ${applicationId} started with protocol ${api}`)
  }

  /**
   * Method called by Engine to stop a given api. This method can be surcharged in the
   * North api implementation to allow to disconnect to a third party application for example.
   * @return {void}
   */
  disconnect() {
    const { applicationId } = this.application
    this.logger.info(`North API ${applicationId} disconnected`)
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party application.
   * @param {object[]} values - The values to handle
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.info('handleValues', values)
    return true
  }

  /**
   * Method called by the Engine to handle a raw file.
   * @param {string} filePath - The path of the raw file
   * @return {Promise} - The handle status
   */
  async handleFile(filePath) {
    this.logger.info('handleFile', filePath)
    return true
  }

  /**
   * Get proxy by name
   * @param {String} proxyName - The name of the proxy
   * @return {*} - The proxy
   */
  getProxy(proxyName) {
    let proxy = null

    if (proxyName) {
      proxy = this.config.engine.proxies.find(({ name }) => name === proxyName)
    }

    return proxy
  }

  /**
   * Get filename without timestamp from file path.
   * @param {string} filePath - The file path
   * @returns {string} - The filename
   */
  static getFilenameWithoutTimestamp(filePath) {
    const { name, ext } = path.parse(filePath)
    const filename = name.substr(0, name.lastIndexOf('-'))
    return `${filename}${ext}`
  }

  /**
   * Method called by Engine to get the stats of the poinId passed
   * @param {*} pointId - The point ID
   * @memberof ApiHandler
   * @return {void}
   * @todo: Do we use this method??? (JFH)
   */
  get(pointId) {
    this.logger.info('Get the stats of ', pointId, 'from ', this.application.api)
  }
}

module.exports = ApiHandler
