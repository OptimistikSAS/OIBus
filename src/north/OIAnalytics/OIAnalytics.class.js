import fs from 'node:fs/promises'

import ApiHandler from '../ApiHandler.class.js'

/**
 * Class OIAnalytics - sends files through a POST Multipart HTTP and values as json payload
 */
export default class OIAnalytics extends ApiHandler {
  static category = 'Optimistik'

  /**
   * Constructor for OIAnalytics
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    const valuesEndpoint = '/api/oianalytics/oibus/time-values'
    const fileEndpoint = '/api/oianalytics/value-upload/file'
    const queryParam = `?dataSourceId=${this.application.name}`

    const {
      host,
      authentication,
      proxy,
    } = applicationParameters.OIAnalytics
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
    this.logger.trace(`OIAnalytics ${this.application.name} handleValues() with ${values.length} values`)
    const cleanedValues = values.filter((value) => value?.data?.value !== undefined
      && value?.data?.value !== null
      && value.timestamp !== null
      && value.pointId !== null)
      .map((value) => ({
        timestamp: value.timestamp,
        data: value.data,
        pointId: value.pointId,
      }))
    await this.postJson(cleanedValues)
    this.logger.debug(`OIAnalytics ${this.application.name} has posted ${cleanedValues.length} values`)
    this.updateStatusDataStream({
      'Last handled values at': new Date().toISOString(),
      'Number of values sent since OIBus has started': this.statusData['Number of values sent since OIBus has started'] + values.length,
      'Last added point id (value)': `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`,
    })
    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The resulting HTTP status
   */
  async handleFile(filePath) {
    const stats = await fs.stat(filePath)
    this.logger.debug(`OIAnalytics ${this.application.name} handleFile(${filePath}) (${stats.size} bytes)`)

    const result = await this.postFile(filePath)
    this.updateStatusDataStream({
      'Last uploaded file': filePath,
      'Number of files sent since OIBus has started': this.statusData['Number of files sent since OIBus has started'] + 1,
      'Last upload at': new Date().toISOString(),
    })
    return result
  }
}
