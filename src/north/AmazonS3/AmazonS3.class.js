import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import ProxyAgent from 'proxy-agent'

import ApiHandler from '../ApiHandler.class.js'

/**
 * Class AmazonS3 - sends files to Amazon AWS S3
 */
export default class AmazonS3 extends ApiHandler {
  static category = 'FileIn'

  /**
   * Constructor for AmazonS3
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { bucket, folder, region, authentication, proxy = null } = applicationParameters.AmazonS3

    this.bucket = bucket
    this.folder = folder
    this.region = region

    const configuredProxy = this.getProxy(proxy)
    let httpAgent
    if (configuredProxy) {
      const { protocol, host, port, username = null, password = null } = configuredProxy

      const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

      if (username && password) {
        proxyOptions.auth = `${username}:${this.encryptionService.decryptText(password)}`
      }

      httpAgent = new ProxyAgent(proxyOptions)
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: authentication.key,
        secretAccessKey: this.encryptionService.decryptText(authentication.secretKey),
      },
      requestHandler: httpAgent ? new NodeHttpHandler({ httpAgent }) : null,
    })

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
      await this.s3.send(new PutObjectCommand(params))
    } catch (error) {
      this.logger.error(error)
      return ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    this.updateStatusDataStream({
      'Last uploaded file': filePath,
      'Number of files sent since OIBus has started': this.statusData['Number of files sent since OIBus has started'] + 1,
      'Last upload at': new Date().toISOString(),
    })
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
    const filename = name.slice(0, name.lastIndexOf('-'))
    return `${filename}${ext}`
  }
}
