const fs = require('node:fs')
const path = require('node:path')

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')

const NorthConnector = require('../north-connector')

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
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
class NorthAmazonS3 extends NorthConnector {
  static category = 'FileIn'

  /**
   * Constructor for NorthAmazonS3
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {Object[]} proxies - The list of available proxies
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
  ) {
    super(
      configuration,
      proxies,
    )
    this.canHandleFiles = true

    const { bucket, folder, region, authentication, proxy } = configuration.settings

    this.bucket = bucket
    this.folder = folder
    this.region = region
    this.authentication = authentication
    this.proxySettings = proxy
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @param {Object} defaultLogParameters - The default logs parameters
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName, defaultLogParameters) {
    await super.start(baseFolder, oibusName, defaultLogParameters)

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.authentication.key,
        secretAccessKey: await this.encryptionService.decryptText(this.authentication.secret),
      },
      requestHandler: this.proxyAgent ? new NodeHttpHandler({ httpAgent: this.proxyAgent }) : null,
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

module.exports = NorthAmazonS3
