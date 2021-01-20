const fs = require('fs')

const ApiHandler = require('../ApiHandler.class')

class OIConnect extends ApiHandler {
  /**
   * Constructor for OIConnect
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, valuesEndpoint, fileEndpoint, authentication, proxy = null } = applicationParameters.OIConnect

    const dataSourceId = `${this.engineConfig.engineName}:${this.application.applicationId}`
    this.valuesUrl = `${host}${valuesEndpoint}?dataSourceId=${dataSourceId}`
    this.fileUrl = `${host}${fileEndpoint}?dataSourceId=${dataSourceId}`
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
    this.logger.silly(`Link handleValues() call with ${values.length} values`)

    await this.postJson(values)
    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    const stats = fs.statSync(filePath)
    this.logger.debug(`handleFile(${filePath}) (${stats.size} bytes)`)
    return this.postFile(filePath)
  }
}

module.exports = OIConnect
