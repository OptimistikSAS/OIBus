const fs = require('node:fs/promises')

const NorthConnector = require('../NorthConnector.class')

/**
 * Class OIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
class OIAnalytics extends NorthConnector {
  static category = 'Optimistik'

  /**
   * Constructor for OIAnalytics
   * @constructor
   * @param {Object} settings - The North connector settings
   * @param {BaseEngine} engine - The engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine)
    this.canHandleValues = true
    this.canHandleFiles = true

    const {
      host,
      authentication,
      proxy,
    } = settings.OIAnalytics
    const queryParam = `?dataSourceId=${this.settings.name}`
    this.valuesUrl = `${host}/api/oianalytics/oibus/time-values${queryParam}`
    this.fileUrl = `${host}/api/oianalytics/value-upload/file${queryParam}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)
  }

  /**
   * Handle values by sending them to OIAnalytics
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)
    // Remove empty values
    const cleanedValues = values.filter((value) => value?.data?.value !== undefined
      && value?.data?.value !== null
      && value.timestamp !== null
      && value.pointId !== null)
      .map((value) => ({
        timestamp: value.timestamp,
        data: value.data,
        pointId: value.pointId,
      }))
    const data = JSON.stringify(values)
    const headers = { 'Content-Type': 'application/json' }
    await this.engine.requestService.httpSend(this.valuesUrl, 'POST', this.authentication, this.proxy, data, headers)
    this.logger.debug(`North "${this.settings.name}" has posted ${cleanedValues.length} values.`)
  }

  /**
   * Handle the file by sending it to OIAnalytics.
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

module.exports = OIAnalytics
