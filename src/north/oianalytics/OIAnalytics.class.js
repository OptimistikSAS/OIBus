const fs = require('fs')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class OIAnalytics - sends files through a POST Multipart HTTP
 */
class OIAnalytics extends ApiHandler {
  /**
   * Constructor for OIAnalytics
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const valuesEndpoint = '/api/optimistik/oibus/data/time_values'
    const fileEndpoint = '/api/optimistik/data/values/upload'
    const queryParam = `?dataSourceId=${this.application.applicationId}`

    const { host, authentication, proxy = null } = applicationParameters.OIAnalytics

    this.valuesUrl = `${host}${valuesEndpoint}${queryParam}`
    this.fileUrl = `${host}${fileEndpoint}${queryParam}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)

    this.canHandleValues = true
    this.canHandleFiles = true
  }

  /**
   * Handle messages by sending them to another OIBus
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`OIAnalytics handleValues() call with ${values.length} values`)

    const cleanedValues = values.map((value) => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId,
    }))
    const data = JSON.stringify(cleanedValues)
    const headers = { 'Content-Type': 'application/json' }
    await this.engine.sendRequest(this.valuesUrl, 'POST', this.authentication, this.proxy, data, headers)

    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    const stats = fs.statSync(filePath)
    this.logger.silly(`OIAnalytics handleFile(${filePath}) (${stats.size} bytes)`)
    return this.engine.sendRequest(this.fileUrl, 'POST', this.authentication, this.proxy, filePath)
  }
}

module.exports = OIAnalytics
