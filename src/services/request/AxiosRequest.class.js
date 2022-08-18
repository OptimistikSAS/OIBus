import axios from 'axios'
import tunnel from 'tunnel'

import BaseRequest from './BaseRequest.class.js'

export default class AxiosRequest extends BaseRequest {
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
   * @return {Promise} - The send status
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
        axiosProxy.proxyAuth = `${username}:${this.engine.encryptionService.decryptText(password)}`
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
      body = this.generateFormDataBody(data)

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
}
