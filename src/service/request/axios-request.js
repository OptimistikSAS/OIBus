const { createReadStream } = require('node:fs')
const path = require('node:path')

const axios = require('axios').default
const tunnel = require('tunnel')

const BaseRequest = require('./base-request')

const { generateFormDataBodyFromFile } = require('../utils')

class AxiosRequest extends BaseRequest {
  /**
   * Send the values using axios
   * If "headers" contains Content-Type "data" is sent as string in the body.
   * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
   * @param {String} requestUrl - The URL to send the request to
   * @param {String} method - The request type
   * @param {Object} headers - The headers
   * @param {Object} proxy - Proxy to use
   * @param {String} data - The data to send
   * @param {Number} timeout - The request timeout
   * @return {Promise<void>} - The result promise
   */
  async sendImplementation(requestUrl, method, headers, proxy, data, timeout) {
    this.logger.trace('sendWithAxios() called')

    const source = axios.CancelToken.source()
    let axiosInstance = axios.create({
      timeout,
      cancelToken: source.token,
    })

    if (proxy) {
      const { protocol, host, port, username, password } = proxy
      const axiosProxy = {
        host,
        port,
      }
      if (username && password) {
        axiosProxy.proxyAuth = `${username}:${await this.engine.encryptionService.decryptText(password)}`
      }
      let tunnelInstance
      if (protocol === 'https') {
        tunnelInstance = tunnel.httpsOverHttps({ axiosProxy })
      } else {
        tunnelInstance = tunnel.httpsOverHttp({ axiosProxy })
      }
      axiosInstance = axios.create({
        httpsAgent: tunnelInstance,
        proxy: false,
        timeout,
        cancelToken: source.token,
      })
    }

    const cancelTimeout = setTimeout(() => {
      source.cancel('Request cancelled by force to prevent axios hanging.')
    }, timeout)

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

    const axiosOptions = {
      method,
      url: requestUrl,
      headers,
      data: body,
    }

    try {
      await axiosInstance(axiosOptions)
    } catch (error) {
      readStream?.close()
      clearTimeout(cancelTimeout)
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const responseError = new Error(`Axios response error: ${error.response.status}`)
        responseError.responseError = true
        responseError.statusCode = error.response.status
        throw responseError
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        const requestError = new Error(error.message)
        requestError.responseError = false
        throw requestError
      } else {
        // Something happened in setting up the request that triggered an Error
        const otherError = new Error(error.message)
        otherError.responseError = false
        throw otherError
      }
    }

    readStream?.close()
    clearTimeout(cancelTimeout)
  }
}

module.exports = AxiosRequest
