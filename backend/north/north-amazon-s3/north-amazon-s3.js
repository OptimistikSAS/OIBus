import fs from 'node:fs'
import path from 'node:path'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'

import NorthConnector from '../north-connector.js'
import manifest from './manifest.js'

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
export default class NorthAmazonS3 extends NorthConnector {
  static category = manifest.category

  /**
   * Constructor for NorthAmazonS3
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      logger,
      manifest,
    )

    const { bucket, folder, region, authentication, proxy } = configuration.settings

    this.bucket = bucket
    this.folder = folder
    this.region = region
    this.authentication = authentication
    this.proxyName = proxy
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName) {
    await super.start()

      const proxyAgent = await this.proxyService.getProxy(this.proxyName)
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.authentication.key,
        secretAccessKey: await this.encryptionService.decryptText(this.authentication.secret),
      },
      requestHandler: proxyAgent ? new NodeHttpHandler({ httpAgent: proxyAgent }) : null,
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
