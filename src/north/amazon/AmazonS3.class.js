const fs = require('fs')
const path = require('path')
const url = require('url')

const AWS = require('aws-sdk')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class AmazonS3 - sends files to Amazon AWS S3
 */
class AmazonS3 extends ApiHandler {
  /**
   * Constructor for AmazonS3
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { bucket, folder, authentication, proxy = null } = applicationParameters.AmazonS3

    this.bucket = bucket
    this.folder = folder

    AWS.config.update({
      accessKeyId: authentication.accessKey,
      secretAccessKey: authentication.secretKey,
    })

    if (proxy) {
      const { host, port, username = null, password = null } = proxy

      const proxyOptions = url.parse(`${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${password}`
      }

      const agent = new ProxyAgent(proxyOptions)
      AWS.config.update({ httpOptions: { agent } })
    }

    this.s3 = new AWS.S3()

    this.canHandleFiles = true
  }

  /**
   * Send the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    const params = {
      Bucket: this.bucket,
      Body: fs.createReadStream(filePath),
      Key: `${this.folder}/${path.basename(filePath)}`,
    }

    try {
      await this.s3.upload(params).promise()
    } catch (error) {
      return Promise.reject(error)
    }

    return true
  }
}

module.exports = AmazonS3
