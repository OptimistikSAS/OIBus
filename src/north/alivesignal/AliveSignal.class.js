const url = require('url')

const fetch = require('node-fetch')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class AliveSignal - sends alive signal to a remote host
 */
class AliveSignal extends ApiHandler {
  /**
   * Constructor for AliveSignal
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, authentication, id, frequency, proxy = null } = applicationParameters.AliveSignal

    this.host = `${host}?id=${encodeURI(id)}`
    this.authentication = authentication
    this.frequency = frequency
    this.proxy = proxy

    this.timer = null
  }

  /**
   * Initiate timer for sending alive signal.
   * @return {void}
   */
  connect() {
    this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
  }

  /**
   * Stop the timer for sending alive signal.
   * @return {void}
   */
  disconnect() {
    clearTimeout(this.timer)
  }

  async pingCallback() {
    const headers = {}
    let agent = null

    // Generate authentication header
    if (this.authentication.type === 'Basic') {
      const basic = Buffer.from(`${this.authentication.username}:${this.authentication.password}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    if (this.proxy) {
      const { host, port, username = null, password = null } = this.proxy

      const proxyOptions = url.parse(`${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${password}`
      }

      agent = new ProxyAgent(proxyOptions)
    }

    const fetchOptions = {
      method: 'GET',
      headers,
      agent,
    }

    try {
      const response = await fetch(this.host, fetchOptions)
      if (response.ok) {
        this.logger.info('Alive signal successful')
      } else {
        this.logger.error(`Alive signal error: ${response.statusText}`)
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
  }
}

module.exports = AliveSignal
