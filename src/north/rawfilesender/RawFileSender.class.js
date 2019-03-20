const fs = require('fs')
const path = require('path')
const url = require('url')

const fetch = require('node-fetch')
const FormData = require('form-data')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class RawFileSender - sends files through a POST Multipart HTTP
 */
class RawFileSender extends ApiHandler {
  /**
   * Constructor for RawFilePoster
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { host, endpoint, authentication, proxy = null } = applicationParameters.RawFileSender

    this.url = `${host}${endpoint}`
    this.authentication = authentication
    this.proxy = proxy

    this.canHandleFiles = true
  }

  /**
   * Send the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    const headers = {}
    let agent = null

    // Generate authentication header
    if (this.authentication.type === 'Basic') {
      const basic = Buffer.from(`${this.authentication.username}:${this.authentication.password}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }

    if (this.proxy) {
      const { host, port, username = null, password = null } = this.proxy

      const proxyOptions = url.parse(`${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${password}`
      }

      agent = new ProxyAgent(proxyOptions)
    }


    // Create form data with the file
    const body = new FormData()
    const readStream = fs.createReadStream(filePath)
    const bodyOptions = { filename: path.basename(filePath) }
    body.append('file', readStream, bodyOptions)

    const fetchOptions = {
      method: 'POST',
      headers,
      body,
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

module.exports = RawFileSender
