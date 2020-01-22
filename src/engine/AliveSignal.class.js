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

    const { enabled, host, endpoint, username, password, id, frequency, proxy = null } = engineConfig.aliveSignal

    this.enabled = enabled
    this.host = `${host}${endpoint}`
    this.authentication = {
      type: 'Basic',
      username,
      password,
    }
    this.id = id
    this.frequency = frequency
    this.proxy = engineConfig.proxies.find(({ name }) => name === proxy)
  }

  /**
   * Start the timer for sending alive signal.
   * @return {void}
   */
  start() {
    if (this.enabled) {
      this.logger.info('Initializing')
      this.timer = setTimeout(this.pingCallback.bind(this), 1000 * this.frequency)
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

  async pingCallback() {
    const headers = { 'Content-Type': 'application/json' }
    let agent = null

    // Generate authentication header
    if (this.authentication.type === 'Basic') {
      const decryptedPassword = this.engine.decryptPassword(this.authentication.password)
      if (decryptedPassword == null) {
        this.logger.error(`Error decrypting auth password for ${this.constructor.name}`)
      }
      const basic = Buffer.from(`${this.authentication.username}:${decryptedPassword}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    if (this.proxy) {
      const { protocol, host, port, username = null, password = null } = this.proxy

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

    const body = await this.engine.getStatus()
    body.id = this.id
    const fetchOptions = {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
      agent,
    }

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

    this.timer = setTimeout(this.pingCallback.bind(this), 1000 * this.frequency)
  }
}

module.exports = AliveSignal
