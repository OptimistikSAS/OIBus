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
    this.logger = new Logger(this.constructor.name)
    const { engineConfig } = this.engine.configService.getConfig()

    const { enabled, host, endpoint, authentication, id, frequency, proxy = null } = engineConfig.aliveSignal

    this.enabled = enabled
    this.host = `${host}${endpoint}`
    this.authentication = authentication
    this.id = id
    this.frequency = 1000 * frequency
    this.proxy = Array.isArray(engineConfig.proxies) && engineConfig.proxies.find(({ name }) => name === proxy)
    this.timer = null
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

    const status = await this.engine.getStatus()
    status.id = this.id

    try {
      const data = JSON.stringify(status)
      const headers = { 'Content-Type': 'application/json' }
      await this.engine.sendRequest(this.host, 'POST', this.authentication, this.proxy, data, headers)
      this.logger.debug('Alive signal successful')
    } catch (error) {
      this.logger.error(error)
    }

    this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
  }

  /**
   * Forward an aliveSignal request.
   * @param {object} data - The content to forward
   * @return {Promise<void>} - The response
   */
  async forwardRequest(data) {
    if (this.enabled) {
      this.logger.debug('Forwarding aliveSignal request')
      const stringData = JSON.stringify(data)
      const headers = { 'Content-Type': 'application/json' }
      await this.engine.sendRequest(this.host, 'POST', this.authentication, this.proxy, stringData, headers)
      this.logger.debug('Forwarding aliveSignal was successful')
    }
  }
}

module.exports = AliveSignal
