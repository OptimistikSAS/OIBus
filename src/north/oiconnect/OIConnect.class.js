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

    const { host, endpoint, authentication, proxy = null } = applicationParameters.OIConnect

    this.url = `${host}${endpoint}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)

    this.canHandleValues = true
  }

  /**
   * Handle messages by sending them to another OIBus
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)

    const data = JSON.stringify({ dataSourceId: this.application.applicationId, values })
    const headers = { 'Content-Type': 'application/json' }
    return this.engine.sendRequest(this.url, 'POST', this.authentication, this.proxy, data, headers)
  }
}

module.exports = OIConnect
