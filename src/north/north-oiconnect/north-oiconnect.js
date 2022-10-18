const fs = require('node:fs/promises')

const NorthConnector = require('../north-connector')

/**
 * Class NorthOIConnect - Send files through a POST Multipart HTTP request and values as JSON payload
 * Both endpoints are configurable by the user, allowing to send data to any HTTP application
 * To send data to another OIBus, use the following endpoints:
 *  -files endpoint: /engine/addFile
 *  -values endpoint: /engine/addValues
 */
class NorthOIConnect extends NorthConnector {
  static category = 'Optimistik'

  /**
   * Constructor for NorthOIConnect
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(configuration, engine) {
    super(configuration, engine)
    this.canHandleValues = true
    this.canHandleFiles = true

    const {
      host,
      valuesEndpoint,
      fileEndpoint,
      authentication,
      proxy,
    } = configuration.settings
    const name = `${this.engineConfig.engineName}:${this.name}`
    this.valuesUrl = `${host}${valuesEndpoint}?name=${name}`
    this.fileUrl = `${host}${fileEndpoint}?name=${name}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)
  }

  /**
   * Handle values by sending them to the specified endpoint
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)
    const data = JSON.stringify(values)
    const headers = { 'Content-Type': 'application/json' }
    await this.engine.requestService.httpSend(this.valuesUrl, 'POST', this.authentication, this.proxy, data, headers)
    this.logger.debug(`OIConnect ${this.name} has posted ${values.length} values.`)
  }

  /**
   * Handle the file by sending it to the specified endpoint.
   * @param {String} filePath - The path of the file
   * @returns {Promise<void>} - The result promise
   */
  async handleFile(filePath) {
    const stats = await fs.stat(filePath)
    this.logger.debug(`Handle file "${filePath}" (${stats.size} bytes).`)

    await this.engine.requestService.httpSend(this.fileUrl, 'POST', this.authentication, this.proxy, filePath)
  }

  /**
   * Overriding parent method to detect if the connector should retry to send the values/files or discard them
   * @param {Object} error - The error thrown by the handleFile / handleValue method
   * @returns {Boolean} - If the values/files must be sent again or not
   */
  shouldRetry(error) {
    if (!error.responseError) {
      // Error from the library, because the endpoint is not reachable for example. In this case we must retry indefinitely
      this.logger.trace('Should retry because of connection error.')
      return true
    }
    // Otherwise, check the HTTP status code
    const retry = [400, 500].includes(error.statusCode)
    this.logger.trace(`Should retry ${retry} because of error status code: ${error.statusCode}.`)
    return retry
  }
}

module.exports = NorthOIConnect
