const fs = require('fs')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class OIAnalyticsFile - sends files through a POST Multipart HTTP
 */
class OIAnalyticsFile extends ApiHandler {
  /**
   * Constructor for OIAnalyticsFile
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, endpoint, authentication, proxy = null } = applicationParameters.OIAnalyticsFile

    this.url = `${host}${endpoint}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)

    this.canHandleFiles = true
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    const stats = fs.statSync(filePath)
    this.logger.silly(`OIAnalyticsFile handleFile() call with ${filePath} (${stats.size} bytes)`)

    return this.engine.sendRequest(this.url, 'POST', this.authentication, this.proxy, filePath)
  }
}

module.exports = OIAnalyticsFile
