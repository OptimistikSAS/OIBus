const axios = require('axios')
const tunnel = require('tunnel')

const BaseRequest = require('./base-request')

const { generateFormDataBodyFromFile } = require('../utils')

class AxiosRequest extends BaseRequest {
  /**
   * Send the values using axios
   * If "headers" contains Content-Type "data" is sent as string in the body.
   * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
   * @param {string} requestUrl - The URL to send the request to
   * @param {string} method - The request type
   * @param {object} headers - The headers
   * @param {object} proxy - Proxy to use
   * @param {string} data - The data to send
   * @param {number} timeout - The request timeout
   * @return {Promise} - The resolved promise
   */
  async sendImplementation(requestUrl, method, headers, proxy, data, timeout) {
    this.logger.trace('sendWithAxios() called')

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
        axiosProxy.proxyAuth = `${username}:${await this.engine.encryptionService.decryptText(password)}`
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

    const cancelTimeout = setTimeout(() => {
      source.cancel('Request cancelled by force to prevent axios hanging')
    }, timeout)

    let body
    if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
      body = data
    } else {
      body = generateFormDataBodyFromFile(data)

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

    clearTimeout(cancelTimeout)
  }
}

module.exports = AxiosRequest
