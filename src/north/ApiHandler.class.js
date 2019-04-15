class ApiHandler {
  /**
   * Constructor for Application
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
    this.logger = engine.logger
    this.config = this.engine.config
    this.scanModes = this.engine.scanModes
  }

  /**
   * Method called by Engine to get the stats of the poinId passed
   * @param {*} pointId - The point ID
   * @memberof ApiHandler
   * @return {void}
   */
  get(pointId) {
    this.engine.logger.info('Get the stats of ', pointId, 'from ', this.application.api)
  }

  /**
   * Method called by Engine to initialize a given api. It needs to be surcharged.
   * @return {void}
   */
  connect() {
    this.engine.logger.info('connect')
  }

  /**
   * Method called by Engine to stop a given api. It needs to be surcharged.
   * @return {void}
   */
  disconnect() {
    this.engine.logger.info('disconnect')
  }

  /**
   * Method called by the Engine to handle a values.
   * @param {object[]} values - The values to handle
   * @return {Promise} - The handle status
   */
  handleValues(values) {
    this.engine.logger.info('handleValues', values)
  }

  /**
   * Method called by the Engine to handle a raw file.
   * @param {string} filePath - The path of the raw file
   * @return {Promise} - The handle status
   */
  handleFile(filePath) {
    this.engine.logger.info('handleFile', filePath)
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
}

module.exports = ApiHandler
