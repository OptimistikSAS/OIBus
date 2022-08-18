import fs from 'node:fs/promises'

import ApiHandler from '../ApiHandler.class.js'

export default class OIConnect extends ApiHandler {
  static category = 'Optimistik'

  /**
   * Constructor for OIConnect
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    const { host, valuesEndpoint, fileEndpoint, authentication, proxy } = applicationParameters.OIConnect
    const name = `${this.engineConfig.engineName}:${this.application.name}`
    this.valuesUrl = `${host}${valuesEndpoint}?name=${name}`
    this.fileUrl = `${host}${fileEndpoint}?name=${name}`
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
    this.updateStatusDataStream({
      'Last handled values at': new Date().toISOString(),
      'Number of values sent since OIBus has started': this.statusData['Number of values sent since OIBus has started'] + values.length,
      'Last added point id (value)': `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`,
    })
    await this.postJson(values)
    this.logger.debug(`OIConnect ${this.application.name} has posted ${values.length} values`)
    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The resulting HTTP status
   */
  async handleFile(filePath) {
    const stats = await fs.stat(filePath)
    this.logger.debug(`OIConnect ${this.application.name} handleFile(${filePath}) (${stats.size} bytes)`)
    this.updateStatusDataStream({
      'Last uploaded file': filePath,
      'Number of files sent since OIBus has started': this.statusData['Number of files sent since OIBus has started'] + 1,
      'Last upload at': new Date().toISOString(),
    })
    return this.postFile(filePath)
  }
}
