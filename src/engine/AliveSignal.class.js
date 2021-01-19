const Logger = require('./Logger.class')

/**
 * Class AliveSignal - sends alive signal to a remote host
 */
class AliveSignal {
  /**
   * Constructor for AliveSignal
   * @constructor
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(engine) {
    this.engine = engine
    this.logger = Logger.getDefaultLogger()
    const { engineConfig } = this.engine.configService.getConfig()

    const { enabled, host, endpoint, authentication, id, frequency, proxy = null, verbose = false } = engineConfig.aliveSignal

    this.enabled = enabled
    this.host = `${host}${endpoint}`
    this.authentication = authentication
    this.id = id
    this.frequency = 1000 * frequency
    this.proxy = Array.isArray(engineConfig.proxies) && engineConfig.proxies.find(({ name }) => name === proxy)
    this.timer = null
    this.verbose = verbose
  }

  /**
   * Start the timer for sending alive signal.
   * @return {void}
   */
  start() {
    if (this.enabled) {
      this.logger.info('Initializing')
      this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
    }
  }

  /**
   * Stop the timer for sending alive signal.
   * @return {void}
   */
  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }

  /**
   * Callback to send the alive signal.
   * @return {Promise<void>} - The response
   */
  async pingCallback() {
    this.logger.silly('pingCallback')

    try {
      const status = await this.prepareStatus()
      await this.engine.requestService.postJsonValues(this.host, status, this.authentication, this.proxy)
      this.logger.debug('Alive signal successful')
    } catch (error) {
      this.logger.error(`sendRequest error status: ${error}`)
    }

    this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
  }

  /**
   * Prepare the status info
   * @returns {object} - The status info
   */
  async prepareStatus() {
    let status = { version: this.engine.getVersion() }
    if (this.verbose) {
      status = await this.engine.getStatus()
    }
    status.id = this.id
    return status
  }

  /**
   * Forward an aliveSignal request.
   * @param {object} data - The content to forward
   * @return {Promise<void>} - The response
   */
  async forwardRequest(data) {
    if (this.enabled) {
      this.logger.debug('Forwarding aliveSignal request')
      await this.engine.requestService.postJsonValues(this.host, data, this.authentication, this.proxy)
      this.logger.debug('Forwarding aliveSignal was successful')
    }
  }
}

module.exports = AliveSignal
