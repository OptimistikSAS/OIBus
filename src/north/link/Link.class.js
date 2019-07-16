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

    const { host, proxy = null, stack = 'fetch' } = applicationParameters.Link

    this.url = host
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
    try {
      switch (this.stack) {
        case 'axios':
          await this.sendWithAxios(values)
          break
        case 'request':
          await this.sendWithRequest(values)
          break
        default:
          await this.sendWithFetch(values)
      }
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the values using axios
   * @param {object[]} values - The values to send
   * @return {AxiosPromise | *} - The send status
   */
  async sendWithAxios(values) {
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
   * @param {object[]} values - The values to send
   * @return {Promise} - The send status
   */
  async sendWithRequest(values) {
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
      body: values,
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
   * @param {object[]} values - The values to send
   * @return {Promise} - The send status
   */
  async sendWithFetch(values) {
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
      body: values,
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
