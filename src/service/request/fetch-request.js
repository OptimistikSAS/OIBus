const { createReadStream } = require('node:fs')
const url = require('node:url')
const path = require('node:path')

const fetch = require('node-fetch')
const ProxyAgent = require('proxy-agent')

const BaseRequest = require('./base-request')

const { generateFormDataBodyFromFile } = require('../utils')

class FetchRequest extends BaseRequest {
  /**
   * Send the request using node-fetch
   * If "headers" contains Content-Type "data" is sent as string in the body.
   * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
   * @param {String} requestUrl - The URL to send the request to
   * @param {String} method - The request type
   * @param {Object} headers - The headers
   * @param {Object} proxy - Proxy to use
   * @param {String} data - The body or file to send
   * @param {Number} timeout - The request timeout
   * @return {Promise<void>} - The result promise
   */
  async sendImplementation(requestUrl, method, headers, proxy, data, timeout) {
    this.logger.trace('sendWithFetch() called')

    let agent = null

    if (proxy) {
      const { protocol, host, port, username, password } = proxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${await this.engine.encryptionService.decryptText(password)}`
      }

      agent = new ProxyAgent(proxyOptions)
    }

    let body
    let readStream
    if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
      body = data
    } else {
      readStream = createReadStream(data)
      body = generateFormDataBodyFromFile(path.parse(data), readStream)

      const formHeaders = body.getHeaders()
      Object.keys(formHeaders).forEach((key) => {
        headers[key] = formHeaders[key]
      })
    }

    const fetchOptions = {
      method,
      headers,
      body,
      agent,
      timeout,
    }

    let response
    try {
      response = await fetch(requestUrl, fetchOptions)
    } catch (error) {
      readStream?.close()
      const requestError = error
      requestError.responseError = false
      throw requestError
    }
    readStream?.close()
    if (!response.ok) {
      const responseError = new Error(response.statusText)
      responseError.responseError = true
      responseError.statusCode = response.status
      throw responseError
    }
  }
}

module.exports = FetchRequest
