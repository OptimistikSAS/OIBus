const fs = require('fs')
const url = require('url')

const fetch = require('node-fetch')
// eslint-disable-next-line import/no-unresolved
const axios = require('axios').default
const request = require('request-promise-native')
const tunnel = require('tunnel')
const FormData = require('form-data')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class OIAnalyticsFile - sends files through a POST Multipart HTTP
 */
class OIAnalyticsFile extends ApiHandler {
  /**
   * Constructor for OIAnalyticsFile
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, endpoint, authentication, proxy = null, stack = 'fetch' } = applicationParameters.OIAnalyticsFile

    this.url = `${host}${endpoint}`
    this.authentication = authentication
    this.proxy = this.getProxy(proxy)
    this.stack = stack

    this.timeout = 60000

    this.canHandleFiles = true
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    this.logger.silly(`OIAnalyticsFile handleFile() call with ${filePath}`)
    const stats = fs.statSync(filePath)
    const fileSizeInBytes = stats.size
    this.logger.debug(`Sending file ${filePath} (${fileSizeInBytes} bytes) using ${this.stack} stack`)

    const headers = {}

    // Generate authentication header
    if (this.authentication.type === 'Basic') {
      const decryptedPassword = this.decryptPassword(this.authentication.password)
      const basic = Buffer.from(`${this.authentication.username}:${decryptedPassword}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    try {
      switch (this.stack) {
        case 'axios':
          await this.sendWithAxios(headers, filePath)
          break
        case 'request':
          await this.sendWithRequest(headers, filePath)
          break
        default:
          await this.sendWithFetch(headers, filePath)
      }
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the file using axios
   * @param {object} headers - The headers
   * @param {string} filePath - The file to send
   * @return {AxiosPromise | *} - The send status
   */
  async sendWithAxios(headers, filePath) {
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
      source.cancel('Request cancelled by timeout to prevent axios hanging')
    }, this.timeout)

    const formData = new FormData()
    const readStream = fs.createReadStream(filePath)
    const bodyOptions = { filename: ApiHandler.getFilenameWithoutTimestamp(filePath) }
    formData.append('file', readStream, bodyOptions)

    const formHeaders = formData.getHeaders()
    Object.keys(formHeaders).forEach((key) => {
      headers[key] = formHeaders[key]
    })

    const axiosOptions = {
      method: 'POST',
      url: this.url,
      headers,
      data: formData,
    }

    try {
      await axiosInstance(axiosOptions)
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }

  /**
   * Send the file using axios
   * @param {object} headers - The headers
   * @param {string} filePath - The file to send
   * @return {Promise} - The send status
   */
  async sendWithRequest(headers, filePath) {
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
      formData: {
        file: {
          value: fs.createReadStream(filePath),
          options: { filename: ApiHandler.getFilenameWithoutTimestamp(filePath) },
        },
      },
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
   * Send the file using node-fetch
   * @param {object} headers - The headers
   * @param {string} filePath - The file to send
   * @return {Promise} - The send status
   */
  async sendWithFetch(headers, filePath) {
    let agent = null

    if (this.proxy) {
      const { protocol, host, port, username = null, password = null } = this.proxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${this.decryptPassword(password)}`
      }

      agent = new ProxyAgent(proxyOptions)
    }

    const formData = new FormData()
    const readStream = fs.createReadStream(filePath)
    const bodyOptions = { filename: ApiHandler.getFilenameWithoutTimestamp(filePath) }
    formData.append('file', readStream, bodyOptions)

    const fetchOptions = {
      method: 'POST',
      headers,
      body: formData,
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

OIAnalyticsFile.schema = require('./schema')

module.exports = OIAnalyticsFile
