const fs = require('fs')
const url = require('url')
const path = require('path')

const AWS = require('aws-sdk')
const ProxyAgent = require('proxy-agent')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class AmazonS3 - sends files to Amazon AWS S3
 */
class AmazonS3 extends ApiHandler {
  static category = 'FileIn'

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
      accessKeyId: authentication.key,
      secretAccessKey: this.encryptionService.decryptText(authentication.secretKey),
    })

    const configuredProxy = this.getProxy(proxy)
    if (configuredProxy) {
      const { protocol, host, port, username = null, password = null } = configuredProxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${this.encryptionService.decryptText(password)}`
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
      Key: `${this.folder}/${this.getFilenameWithoutTimestamp(filePath)}`,
    }

    try {
      await this.s3.upload(params).promise()
    } catch (error) {
      this.logger.error(error)
      return ApiHandler.STATUS.COMMUNICATION_ERROR
    }

    return ApiHandler.STATUS.SUCCESS
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
}

module.exports = AmazonS3
