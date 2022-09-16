/**
 * Class HealthSignal - sends health signal to a remote host or into the logs
 */
class HealthSignal {
  /**
   * Constructor for HealthSignal
   * @constructor
   * @param {OIBusEngine} engine - The Engine
   * @return {void}
   */
  constructor(engine) {
    this.engine = engine
    this.logger = engine.logger
    const { engineConfig } = this.engine.configService.getConfig()

    const { http, logging } = engineConfig.healthSignal

    this.logging = logging

    this.http = http
    this.http.proxy = Array.isArray(engineConfig.proxies) ? engineConfig.proxies.find(({ name }) => name === this.http.proxy) : null
    this.httpTimer = null
    this.loggingTimer = null
    this.engineName = engineConfig.engineName
  }

  /**
   * Start the timer for sending health signal.
   * @return {void}
   */
  start() {
    if (this.http.enabled) {
      this.logger.debug('Initializing HTTP health signal.')
      this.httpTimer = setInterval(this.sendHttpSignal.bind(this), this.http.frequency * 1000)
    }
    if (this.logging.enabled) {
      this.logger.debug('Initializing logging health signal.')
      this.loggingTimer = setInterval(this.sendLoggingSignal.bind(this), this.logging.frequency * 1000)
    }
  }

  /**
   * Stop the timers for sending health signal.
   * @return {void}
   */
  stop() {
    if (this.httpTimer) {
      clearInterval(this.httpTimer)
    }
    if (this.loggingTimer) {
      clearInterval(this.loggingTimer)
    }
  }

  /**
   * Callback to send the health signal with http.
   * @return {Promise<void>} - The response
   */
  async sendHttpSignal() {
    const healthStatus = this.prepareStatus(this.http.verbose)
    healthStatus.id = this.engineName
    try {
      const data = JSON.stringify(healthStatus)
      const headers = { 'Content-Type': 'application/json' }
      await this.engine.requestService.httpSend(
        `${this.http.host}${this.http.endpoint}`,
        'POST',
        this.http.authentication,
        this.http.proxy,
        data,
        headers,
      )
      this.logger.debug('HTTP health signal sent successfully.')
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Callback to send the health signal with logger.
   * @returns {void}
   */
  sendLoggingSignal() {
    const healthStatus = this.prepareStatus(true)
    this.logger.info(JSON.stringify(healthStatus))
  }

  /**
   * Retrieve status information from the engine
   * @param {Boolean} verbose - Return only the static OIBus info when false, return full status when true
   * @returns {Object} - The status of OIBus
   */
  prepareStatus(verbose) {
    let status = this.engine.getOIBusInfo()
    if (verbose) {
      status = { ...status, ...this.engine.statusData }
    }
    return status
  }

  /**
   * Log and forward an healthSignal request.
   * @param {Object} data - The content to forward
   * @return {Promise<void>} - The response
   */
  async forwardRequest(data) {
    const stringData = JSON.stringify(data)
    if (this.http.enabled) {
      this.logger.trace(`Forwarding health signal to "${this.http.host}".`)
      const headers = { 'Content-Type': 'application/json' }
      this.logger.info(stringData)
      await this.engine.requestService.httpSend(
        `${this.http.host}${this.http.endpoint}`,
        'POST',
        this.http.authentication,
        this.http.proxy,
        stringData,
        headers,
      )
      this.logger.trace(`Health signal successfully forwarded to "${this.http.host}".`)
    } else {
      this.logger.warn('HTTP health signal is disabled. Cannot forward payload.')
      this.logger.info(stringData)
    }
  }
}

module.exports = HealthSignal
