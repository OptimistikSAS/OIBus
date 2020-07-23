const fs = require('fs')
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
      secretAccessKey: this.decryptPassword(authentication.secretKey),
    })

    const configuredProxy = this.getProxy(proxy)
    if (configuredProxy) {
      const { protocol, host, port, username = null, password = null } = configuredProxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${this.decryptPassword(password)}`
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
      Key: `${this.folder}/${ApiHandler.getFilenameWithoutTimestamp(filePath)}`,
    }

    try {
      await this.s3.upload(params).promise()
    } catch (error) {
      this.logger.error(error)
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }

    return 1
  }
}

module.exports = AmazonS3
