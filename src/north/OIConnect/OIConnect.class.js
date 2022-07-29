const fs = require('fs/promises')

const { NorthHandler } = global

class OIConnect extends NorthHandler {
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
  }

  /**
   * Handle messages by sending them to another OIBus
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.statusData['Last handled values at'] = new Date().toISOString()
    this.statusData['Number of values sent since OIBus has started'] += values.length
    this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
    this.updateStatusDataStream()
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
    this.statusData['Last uploaded file'] = filePath
    this.statusData['Number of files sent since OIBus has started'] += 1
    this.statusData['Last upload at'] = new Date().toISOString()
    this.updateStatusDataStream()
    return this.postFile(filePath)
  }
}

OIConnect.schema = require('./OIConnect.schema')

module.exports = OIConnect
