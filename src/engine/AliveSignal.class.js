const url = require('url')

const fetch = require('node-fetch')
const ProxyAgent = require('proxy-agent')

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
   * Generate request headers
   * @param {object} authentication - Authentication parameters
   * @return {{'Content-Type': string}} - The headers
   */
  generateHeaders(authentication) {
    const headers = { 'Content-Type': 'application/json' }

    if (authentication.type === 'Basic') {
      const decryptedPassword = this.engine.decryptPassword(authentication.password)
      if (decryptedPassword == null) {
        this.logger.error(`Error decrypting auth password for ${this.constructor.name}`)
      }
      const basic = Buffer.from(`${authentication.username}:${decryptedPassword}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    return headers
  }

  /**
   * Construct proxy agent
   * @param {object} proxy - The proxy parameters
   * @return {null} - The proxy agent
   */
  configureProxyAgent(proxy) {
    let agent = null

    if (proxy) {
      const { protocol, host, port, username = null, password = null } = proxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        const decryptedPassword = this.engine.decryptPassword(password)
        if (decryptedPassword == null) {
          this.logger.error(`Error decrypting proxy password for ${this.constructor.name}`)
        }

        proxyOptions.auth = `${username}:${decryptedPassword}`
      }

      agent = new ProxyAgent(proxyOptions)
    }

    return agent
  }

  /**
   * Callback to send the alive signal.
   * @return {Promise<void>} - The response
   */
  async pingCallback() {
    const headers = this.generateHeaders(this.authentication)
    const status = await this.engine.getStatus()
    status.id = this.id
    const body = JSON.stringify(status)

    const fetchOptions = {
      method: 'POST',
      body,
      headers,
    }

    if (this.proxy) fetchOptions.agent = this.configureProxyAgent(this.proxy)

    try {
      const response = await fetch(this.host, fetchOptions)
      if (response.ok) {
        this.logger.info('Alive signal successful')
      } else {
        this.logger.error(new Error(`Alive signal error: ${response.statusText}`))
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.timer = setTimeout(this.pingCallback.bind(this), this.frequency)
  }
}

module.exports = AliveSignal
