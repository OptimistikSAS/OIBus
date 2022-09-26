// HTTP response status code which yields to retry the HTTP request
const RETRY_STATUS_CODE = [400, 500]

/**
 * Base class to manage HTTP POST method for JSON payloads and file body parts
 */
class BaseRequest {
  constructor(engine) {
    this.engine = engine
    this.logger = engine.logger
  }

  /**
   * Send implementation.
   *
   * If "headers" contains Content-Type "data" is sent as string in the body.
   * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
   * @param {string} requestUrl - The URL to send the request to
   * @param {string} method - The request type
   * @param {object} headers - The headers
   * @param {object} proxy - Proxy to use
   * @param {string} data - The data to send
   * @param {number} timeout - The request timeout
   * @return {void}
   */
  async sendImplementation(requestUrl, method, headers, proxy, data, timeout) {
    this.logger.warn('sendImplementation() should be surcharged'
    + `Function called with ${method} ${requestUrl} and headers "${JSON.stringify(headers)}", `
    + `proxy "${proxy}", data "${data}" and timeout ${timeout}.`)
  }

  /**
   * Send HTTP request.
   *
   * If "baseHeader" contains Content-Type "data" is sent as string in the body.
   * If "baseHeader" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
   * @param {string} requestUrl - The URL to send the request to
   * @param {string} method - The request type
   * @param {object} authentication - Authentication info
   * @param {object} proxy - Proxy to use
   * @param {string} data - The body or file to send
   * @param {object} baseHeaders - Headers to send
   * @param {number} retryCount - The retry count
   * @returns {void}
   */
  async httpSend(requestUrl, method, authentication, proxy, data, baseHeaders = {}, retryCount = 0) {
    const { engineConfig: { httpRequest } } = this.engine.configService.getConfig()

    this.logger.trace(`httpSend() to ${method} ${requestUrl} using ${httpRequest.stack} stack.`)

    // Generate authentication header
    const headers = baseHeaders
    if (authentication) {
      switch (authentication.type) {
        case 'Basic': {
          const decryptedPassword = await this.engine.encryptionService.decryptText(authentication.password)
          const basic = Buffer.from(`${authentication.username}:${decryptedPassword}`).toString('base64')
          headers.Authorization = `Basic ${basic}`
          break
        }
        case 'API Key': {
          headers[authentication.key] = await this.engine.encryptionService.decryptText(authentication.secretKey)
          break
        }
        case 'Bearer': {
          headers.Authorization = `Bearer ${await this.engine.encryptionService.decryptText(authentication.token)}`
          break
        }
        default:
          throw new Error(`Unrecognized authentication type: "${authentication.type}".`)
      }
    }

    try {
      const timeout = 1000 * httpRequest.timeout
      await this.sendImplementation(requestUrl, method, headers, proxy, data, timeout)
    } catch (errorResult) {
      this.logger.error(errorResult.error)

      if (errorResult.responseError) {
        if (RETRY_STATUS_CODE.includes(errorResult.statusCode)) {
          if (retryCount < httpRequest.retryCount) {
            const incrementedRetryCount = retryCount + 1
            await this.httpSend(requestUrl, method, authentication, proxy, data, baseHeaders, incrementedRetryCount)
            return
          }
          throw new Error(`Fail to send HTTP request after too many attempt (${retryCount}).`)
        }
      }
      throw new Error(`HTTP request failed: ${errorResult}.`)
    }

    this.logger.trace(`httpSend() to ${method} ${requestUrl} using ${httpRequest.stack} stack Ok`)
  }
}

module.exports = BaseRequest
