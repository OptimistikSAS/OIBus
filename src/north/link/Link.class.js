const url = require('url')

const fetch = require('node-fetch')
const axios = require('axios').default
const request = require('request-promise-native')
const tunnel = require('tunnel')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

class Link extends ApiHandler {
  /**
   * Constructor for Link
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, endpoint, authentication, proxy = null, stack = 'fetch' } = applicationParameters.Link

    this.url = `${host}${endpoint}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)
    this.stack = stack

    this.timeout = 60000

    this.canHandleValues = true
  }

  /**
   * Handle values by printing them to the console.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    // Generate authentication header
    const headers = { 'Content-Type': 'application/json' }

    if (this.authentication.type === 'Basic') {
      const decryptedPassword = this.decryptPassword(this.authentication.password)
      const basic = Buffer.from(`${this.authentication.username}:${decryptedPassword}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    try {
      switch (this.stack) {
        case 'axios':
          await this.sendWithAxios(headers, values)
          break
        case 'request':
          await this.sendWithRequest(headers, values)
          break
        default:
          await this.sendWithFetch(headers, values)
      }
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the values using axios
   * @param {object} headers - The headers
   * @param {object[]} values - The values to send
   * @return {AxiosPromise | *} - The send status
   */
  async sendWithAxios(headers, values) {
    const source = axios.CancelToken.source()

    let axiosInstance = axios.create({
      timeout: this.timeout,
      cancelToken: source.token,
    })

    if (this.proxy) {
      const { protocol, host, port, username = null, password = null } = this.proxy

      const proxy = {
        host,
        port,
      }

      if (username && password) {
        proxy.proxyAuth = `${username}:${this.decryptPassword(password)}`
      }

      let tunnelInstance = tunnel.httpsOverHttp({ proxy })
      if (protocol === 'https') {
        tunnelInstance = tunnel.httpsOverHttps({ proxy })
      }

      axiosInstance = axios.create({
        httpsAgent: tunnelInstance,
        proxy: false,
        timeout: this.timeout,
        cancelToken: source.token,
      })
    }

    setTimeout(() => {
      source.cancel('Request cancelled by force to prevent axios hanging')
    }, this.timeout)

    const axiosOptions = {
      method: 'POST',
      url: this.url,
      headers,
      data: values,
    }

    try {
      await axiosInstance(axiosOptions)
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the values using request
   * @param {object} headers - The headers
   * @param {object[]} values - The values to send
   * @return {Promise} - The send status
   */
  async sendWithRequest(headers, values) {
    let proxy = false
    if (this.proxy) {
      const { protocol, host, port, username = null, password = null } = this.proxy
      if (username && password) {
        proxy = `${protocol}://${username}:${this.decryptPassword(password)}@${host}:${port}`
      } else {
        proxy = `${protocol}://${host}:${port}`
      }
    }

    const requestOptions = {
      method: 'POST',
      url: this.url,
      headers,
      body: JSON.stringify(values),
      proxy,
    }

    try {
      await request(requestOptions)
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the values using node-fetch
   * @param {object} headers - The headers
   * @param {object[]} values - The values to send
   * @return {Promise} - The send status
   */
  async sendWithFetch(headers, values) {
    let agent = null

    if (this.proxy) {
      const { protocol, host, port, username = null, password = null } = this.proxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${this.decryptPassword(password)}`
      }

      agent = new ProxyAgent(proxyOptions)
    }

    const fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(values),
      agent,
    }

    try {
      const response = await fetch(this.url, fetchOptions)
      if (!response.ok) {
        return Promise.reject(new Error(response.statusText))
      }
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }
}

Link.schema = require('./schema')

module.exports = Link
