const fs = require('fs')
const path = require('path')
const url = require('url')

const fetch = require('node-fetch')
const axios = require('axios').default
const tunnel = require('tunnel')
const FormData = require('form-data')
const ProxyAgent = require('proxy-agent')

const Logger = require('../engine/Logger.class')
const ApiHandler = require('../north/ApiHandler.class')

const logger = Logger.getDefaultLogger()
const retryStatusCodes = [400, 500]

/**
 * Get filename without timestamp from file path.
 * @param {string} filePath - The file path
 * @returns {string} - The filename
 */
const getFilenameWithoutTimestamp = (filePath) => {
  const { name, ext } = path.parse(filePath)
  const filename = name.substr(0, name.lastIndexOf('-'))
  return `${filename}${ext}`
}

/**
 * Generate body as FormData to send file.
 * @param {string} filePath - The file path
 * @returns {FormData} - The body
 */
const generateFormDataBody = (filePath) => {
  const body = new FormData()
  const readStream = fs.createReadStream(filePath)
  const bodyOptions = { filename: getFilenameWithoutTimestamp(filePath) }
  body.append('file', readStream, bodyOptions)
  return body
}

/**
 * Send the values using axios
 * If "headers" contains Content-Type "data" is sent as string in the body.
 * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 * @param {Engine} engine - The engine
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} headers - The headers
 * @param {object} proxy - Proxy to use
 * @param {string} data - The data to send
 * @param {number} timeout - The request timeout
 * @return {Promise} - The send status
 */
const sendWithAxios = async (engine, requestUrl, method, headers, proxy, data, timeout) => {
  logger.silly('sendWithAxios() called')

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
      axiosProxy.proxyAuth = `${username}:${engine.encryptionService.decryptText(password)}`
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

  let body
  if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
    body = data
  } else {
    body = generateFormDataBody(data)

    const formHeaders = body.getHeaders()
    Object.keys(formHeaders).forEach((key) => {
      headers[key] = formHeaders[key]
    })
  }

  const axiosOptions = {
    method,
    url: requestUrl,
    headers,
    data: body,
  }

  try {
    await axiosInstance(axiosOptions)
  } catch (error) {
    const responseError = {
      responseError: !!error.response,
      statusCode: error.response ? error.response.status : undefined,
      error,
    }
    return Promise.reject(responseError)
  }

  return true
}

/**
 * Send the request using node-fetch
 * If "headers" contains Content-Type "data" is sent as string in the body.
 * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 * @param {Engine} engine - The engine
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} headers - The headers
 * @param {object} proxy - Proxy to use
 * @param {string} data - The body or file to send
 * @param {number} timeout - The request timeout
 * @return {Promise} - The send status
 */
const sendWithFetch = async (engine, requestUrl, method, headers, proxy, data, timeout) => {
  logger.silly('sendWithFetch() called')

  let agent = null

  if (proxy) {
    const { protocol, host, port, username = null, password = null } = proxy

    const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

    if (username && password) {
      proxyOptions.auth = `${username}:${engine.encryptionService.decryptText(password)}`
    }

    agent = new ProxyAgent(proxyOptions)
  }

  let body
  if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
    body = data
  } else {
    body = generateFormDataBody(data)

    const formHeaders = body.getHeaders()
    Object.keys(formHeaders).forEach((key) => {
      headers[key] = formHeaders[key]
    })
  }

  const fetchOptions = {
    method: 'POST',
    headers,
    body,
    agent,
    timeout,
  }

  try {
    const response = await fetch(requestUrl, fetchOptions)
    if (!response.ok) {
      const responseError = {
        responseError: true,
        statusCode: response.status,
        error: new Error(response.statusText),
      }
      return Promise.reject(responseError)
    }
  } catch (error) {
    const connectError = {
      responseError: false,
      error,
    }
    return Promise.reject(connectError)
  }

  return true
}

/**
 * Send HTTP request.
 * If "baseHeader" contains Content-Type "data" is sent as string in the body.
 * If "baseHeader" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 * @param {Engine} engine - The engine
 * @param {string} requestUrl - The URL to send the request to
 * @param {string} method - The request type
 * @param {object} authentication - Authentication info
 * @param {object} proxy - Proxy to use
 * @param {string} data - The body or file to send
 * @param {object} baseHeaders - Headers to send
 * @param {number} retryCount - The retry count
 * @returns {Promise} - The send status
 */
const sendRequest = async (engine, requestUrl, method, authentication, proxy, data, baseHeaders = {}, retryCount = 0) => {
  const { engineConfig: { httpRequest } } = engine.configService.getConfig()

  logger.silly(`sendRequest() to ${method} ${requestUrl} using ${httpRequest.stack} stack`)

  // Generate authentication header
  const headers = baseHeaders
  if (authentication && (authentication.type === 'Basic')) {
    const decryptedPassword = engine.encryptionService.decryptText(authentication.password)
    const basic = Buffer.from(`${authentication.username}:${decryptedPassword}`).toString('base64')
    headers.Authorization = `Basic ${basic}`
  }

  try {
    const timeout = 1000 * httpRequest.timeout
    switch (httpRequest.stack) {
      case 'axios':
        await sendWithAxios(engine, requestUrl, method, headers, proxy, data, timeout)
        break
      default:
        await sendWithFetch(engine, requestUrl, method, headers, proxy, data, timeout)
    }
  } catch (errorResult) {
    logger.error(`sendRequest(): Error ${errorResult.error}`)

    if (errorResult.responseError) {
      if (retryStatusCodes.includes(errorResult.statusCode)) {
        if (retryCount < httpRequest.retryCount) {
          const incrementedRetryCount = retryCount + 1
          await sendRequest(engine, requestUrl, method, authentication, proxy, data, baseHeaders, incrementedRetryCount)
        } else {
          throw ApiHandler.STATUS.LOGIC_ERROR
        }
      }
    }

    throw ApiHandler.STATUS.COMMUNICATION_ERROR
  }

  logger.silly(`sendRequest() to ${method} ${requestUrl} using ${httpRequest.stack} stack Ok`)

  return ApiHandler.STATUS.SUCCESS
}

module.exports = { sendRequest }
