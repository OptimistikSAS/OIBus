const fs = require('fs')
const path = require('path')
const FormData = require('form-data')

const Logger = require('../../engine/logger/Logger.class')
const ApiHandler = require('../../north/ApiHandler.class')

class BaseRequest {
  constructor(engine) {
    this.engine = engine
    this.logger = Logger.getDefaultLogger()

    this.retryStatusCodes = [400, 500]
  }

  /**
   * Get filename without timestamp from file path.
   * @param {string} filePath - The file path
   * @returns {string} - The filename
   */
  /* eslint-disable-next-line class-methods-use-this */
  getFilenameWithoutTimestamp(filePath) {
    const { name, ext } = path.parse(filePath)
    const filename = name.substr(0, name.lastIndexOf('-'))
    return `${filename}${ext}`
  }

  /**
   * Generate body as FormData to send file.
   * @param {string} filePath - The file path
   * @returns {FormData} - The body
   */
  generateFormDataBody(filePath) {
    const body = new FormData()
    const readStream = fs.createReadStream(filePath)
    const bodyOptions = { filename: this.getFilenameWithoutTimestamp(filePath) }
    body.append('file', readStream, bodyOptions)
    return body
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
   * @return {Promise} - The send status
   */
  // eslint-disable-next-line no-unused-vars
  async sendImplementation(requestUrl, method, headers, proxy, data, timeout) {
    this.logger.warn('sendImplementation() should be surcharged')
    return true
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
   * @returns {Promise} - The send status
   */
  async httpSend(requestUrl, method, authentication, proxy, data, baseHeaders = {}, retryCount = 0) {
    const { engineConfig: { httpRequest } } = this.engine.configService.getConfig()

    this.logger.silly(`sendRequest() to ${method} ${requestUrl} using ${httpRequest.stack} stack`)

    // Generate authentication header
    const headers = baseHeaders
    if (authentication) {
      switch (authentication.type) {
        case 'Basic': {
          const decryptedPassword = this.engine.encryptionService.decryptText(authentication.password)
          const basic = Buffer.from(`${authentication.username}:${decryptedPassword}`).toString('base64')
          headers.Authorization = `Basic ${basic}`
          break
        }
        case 'API Key': {
          headers[authentication.key] = this.engine.encryptionService.decryptText(authentication.secretKey)
          break
        }
        case 'Bearer': {
          headers.Authorization = `Bearer ${this.engine.encryptionService.decryptText(authentication.token)}`
          break
        }
        default: throw ApiHandler.STATUS.LOGIC_ERROR
      }
    }

    try {
      const timeout = 1000 * httpRequest.timeout
      await this.sendImplementation(requestUrl, method, headers, proxy, data, timeout)
    } catch (errorResult) {
      this.logger.error(`sendRequest(): Error ${errorResult.error}`)

      if (errorResult.responseError) {
        if (this.retryStatusCodes.includes(errorResult.statusCode)) {
          if (retryCount < httpRequest.retryCount) {
            const incrementedRetryCount = retryCount + 1
            await this.httpSend(requestUrl, method, authentication, proxy, data, baseHeaders, incrementedRetryCount)
          } else {
            throw ApiHandler.STATUS.LOGIC_ERROR
          }
        }
      }

      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }

    this.logger.silly(`sendRequest() to ${method} ${requestUrl} using ${httpRequest.stack} stack Ok`)

    return ApiHandler.STATUS.SUCCESS
  }
}

module.exports = BaseRequest
