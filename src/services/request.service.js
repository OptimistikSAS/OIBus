const url = require('url')

const fetch = require('node-fetch')
const axios = require('axios').default
const request = require('request-promise-native')
const tunnel = require('tunnel')
const ProxyAgent = require('proxy-agent')

const Logger = require('../engine/Logger.class')

const logger = new Logger('request')

/**
 * Send the values using axios
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} headers - The headers
 * @param {object} proxy - Proxy to use
 * @param {object} body - The body to send
 * @param {number} timeout - The request timeout
 * @return {Promise} - The send status
 */
const sendWithAxios = async (requestUrl, method, headers, proxy, body, timeout) => {
  logger.silly(`Link sendWithAxios() call with ${body.values.length} values`)

  const source = axios.CancelToken.source()

  let axiosInstance = axios.create({
    timeout,
    cancelToken: source.token,
  })

  if (proxy) {
    const { protocol, host, port, username = null, password = null } = proxy

    const axiosProxy = {
      host,
      port,
    }

    if (username && password) {
      axiosProxy.proxyAuth = `${username}:${this.decryptPassword(password)}`
    }

    let tunnelInstance = tunnel.httpsOverHttp({ axiosProxy })
    if (protocol === 'https') {
      tunnelInstance = tunnel.httpsOverHttps({ axiosProxy })
    }

    axiosInstance = axios.create({
      httpsAgent: tunnelInstance,
      proxy: false,
      timeout,
      cancelToken: source.token,
    })
  }

  setTimeout(() => {
    source.cancel('Request cancelled by force to prevent axios hanging')
  }, timeout)

  const axiosOptions = {
    method,
    url: requestUrl,
    headers,
    data: body,
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
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} headers - The headers
 * @param {object} proxy - Proxy to use
 * @param {object} body - The body to send
 * @param {number} timeout - The request timeout
 */
const sendWithRequest = async (requestUrl, method, headers, proxy, body, timeout) => {
  logger.silly(`Link sendWithRequest() call with ${body.values.length} values`)

  let requestProxy = false
  if (proxy) {
    const { protocol, host, port, username = null, password = null } = this.proxy
    if (username && password) {
      requestProxy = `${protocol}://${username}:${this.decryptPassword(password)}@${host}:${port}`
    } else {
      requestProxy = `${protocol}://${host}:${port}`
    }
  }

  const requestOptions = {
    method,
    url: requestUrl,
    headers,
    body: JSON.stringify(body),
    proxy: requestProxy,
    timeout,
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
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} headers - The headers
 * @param {object} proxy - Proxy to use
 * @param {object} body - The body to send
 * @param {number} timeout - The request timeout
 * @return {Promise} - The send status
 */
const sendWithFetch = async (requestUrl, method, headers, proxy, body, timeout) => {
  this.logger.silly(`Link sendWithFetch() call with ${body.values.length} values`)

  let agent = null

  if (proxy) {
    const { protocol, host, port, username = null, password = null } = proxy

    const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

    if (username && password) {
      proxyOptions.auth = `${username}:${this.decryptPassword(password)}`
    }

    agent = new ProxyAgent(proxyOptions)
  }

  const fetchOptions = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    agent,
    timeout,
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

/**
 * Send HTTP request.
 * @param {Engine} engine - The engine
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} authentication - Authentication info
 * @param {object} proxy - Proxy to use
 * @param {object} body - The body to send
 * @returns {Promise} - The send status
 */
const sendRequest = async (engine, requestUrl, method, authentication, proxy, body) => {
  const { engineConfig } = engine.configService.getConfig()

  logger.silly(`sendRequest() to ${method} ${requestUrl} using ${engineConfig.httpRequest.stack} stack`)

  // Generate authentication header
  const headers = { 'Content-Type': 'application/json' }

  if (authentication.type === 'Basic') {
    const decryptedPassword = engine.decryptPassword(authentication.password)
    const basic = Buffer.from(`${authentication.username}:${decryptedPassword}`).toString('base64')
    headers.Authorization = `Basic ${basic}`
  }

  try {
    switch (engineConfig.httpRequest.stack) {
      case 'axios':
        await sendWithAxios(requestUrl, method, headers, proxy, body, engineConfig.httpRequest.timeout)
        break
      case 'request':
        await sendWithRequest(requestUrl, method, headers, proxy, body, engineConfig.httpRequest.timeout)
        break
      default:
        await sendWithFetch(requestUrl, method, headers, proxy, body, engineConfig.httpRequest.timeout)
    }
  } catch (error) {
    return Promise.reject(error)
  }

  return true
}

module.exports = { sendRequest }
