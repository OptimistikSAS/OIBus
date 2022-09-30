const fs = require('node:fs')
const url = require('node:url')
const path = require('node:path')

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')
const ProxyAgent = require('proxy-agent')

const NorthConnector = require('../NorthConnector.class')

/**
 * Get filename without timestamp from file path.
 * @param {String} filePath - The file path
 * @returns {String} - The filename
 */
const getFilenameWithoutTimestamp = (filePath) => {
  const { name, ext } = path.parse(filePath)
  const filename = name.slice(0, name.lastIndexOf('-'))
  return `${filename}${ext}`
}

/**
 * Class AmazonS3 - sends files to Amazon AWS S3
 */
class AmazonS3 extends NorthConnector {
  static category = 'FileIn'

  /**
   * Constructor for AmazonS3
   * @constructor
   * @param {Object} settings - The North connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine)
    this.canHandleFiles = true

    const { bucket, folder, region, authentication, proxy } = settings.AmazonS3

    this.bucket = bucket
    this.folder = folder
    this.region = region
    this.authentication = authentication
    this.proxy = proxy
  }

  async init() {
    await super.init()
    const configuredProxy = this.getProxy(this.proxy)
    let httpAgent
    if (configuredProxy) {
      const { protocol, host, port, username, password } = configuredProxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${await this.encryptionService.decryptText(password)}`
      }

      httpAgent = new ProxyAgent(proxyOptions)
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.authentication.key,
        secretAccessKey: await this.encryptionService.decryptText(this.authentication.secretKey),
      },
      requestHandler: httpAgent ? new NodeHttpHandler({ httpAgent }) : null,
    })
  }

  /**
   * Send the file.
   * @param {String} filePath - The path of the file
   * @returns {Promise<void>} - The result promise
   */
  async handleFile(filePath) {
    const params = {
      Bucket: this.bucket,
      Body: fs.createReadStream(filePath),
      Key: `${this.folder}/${getFilenameWithoutTimestamp(filePath)}`,
    }

    await this.s3.send(new PutObjectCommand(params))
  }
}

module.exports = AmazonS3
