const fs = require('fs')
const path = require('path')

const fetch = require('node-fetch')
const FormData = require('form-data')

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

    const { host, endpoint, authentication } = applicationParameters.RawFileSender

    this.url = `${host}${endpoint}`
    this.authentication = authentication
  }

  /**
   * Send the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  handleFile(filePath) {
    return new Promise((resolve, reject) => {
      const headers = {}

      // Generate authentication header
      if (this.authentication.type === 'Basic') {
        const basic = Buffer.from(`${this.authentication.username}:${this.authentication.password}`).toString('base64')
        headers.Authorization = `Basic ${basic}`
      }

      // Create form data with the file
      const body = new FormData()
      const readStream = fs.createReadStream(filePath)
      const options = { filename: path.basename(filePath) }
      body.append('file', readStream, options)

      // Send the file
      fetch(this.url, {
        method: 'POST',
        headers,
        body,
      })
        .then((response) => {
          if (response.ok) {
            resolve()
          } else {
            reject(response.statusText)
          }
          resolve()
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}

module.exports = RawFileSender
