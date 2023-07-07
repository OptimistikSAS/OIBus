import fs from 'node:fs/promises'
import path from 'node:path'

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
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
 * Class NorthAzureBlob - sends files to Amazon AWS S3
 */
export default class NorthAzureBlob extends NorthConnector {
  static category = manifest.category

  /**
     * Constructor for NorthAzureBlob
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

    const { account, container, authentication, sasToken, accessKey, tenantId, clientId, clientSecret } = configuration.settings

    this.account = account
    this.container = container
    this.blobPath = configuration.settings.path
    this.authentication = authentication
    this.sasToken = sasToken
    this.accessKey = accessKey
    this.tenantId = tenantId
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  /**
     * Initialize services (logger, certificate, status data) at startup
     * @param {String} baseFolder - The base cache folder
     * @param {String} oibusName - The OIBus name
     * @returns {Promise<void>} - The result promise
     */
  async start(baseFolder, oibusName) {
    await super.start(baseFolder, oibusName)

    if (this.authentication === 'sas') {
      const decodedToken = await this.encryptionService.decryptText(this.sasToken)
      this.blobClient = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net?${decodedToken}`,
      )
      this.logger.info('Initialized blob client with sas strategy')
    } else if (this.authentication === 'aad') {
      process.env.AZURE_TENANT_ID = this.tenantId
      process.env.AZURE_CLIENT_ID = this.clientId
      process.env.AZURE_CLIENT_SECRET = this.clientSecret
      const defaultAzureCredential = new DefaultAzureCredential()
      this.blobClient = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        defaultAzureCredential,
      )
    } else if (this.authentication === 'accessKey') {
      const decodedKey = await this.encryptionService.decryptText(this.accessKey)

      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.account,
        decodedKey,
      )
      this.blobClient = new BlobServiceClient(
        `https://${this.account}.blob.core.windows.net`,
        sharedKeyCredential,
      )
    }
  }

  /**
     * Send the file.
     * @param {String} filePath - The path of the file
     * @returns {Promise<void>} - The result promise
     */
  async handleFile(filePath) {
    const blobName = `${this.blobPath}/${getFilenameWithoutTimestamp(filePath)}`
    const stats = await fs.stat(filePath)
    const content = await fs.readFile(filePath)
    const containerClient = this.blobClient.getContainerClient(this.container)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    const uploadBlobResponse = await blockBlobClient.upload(content, stats.size)
    this.logger.info(`Upload block blob "${blobName}" successfully with requestId: ${uploadBlobResponse.requestId}`)
  }
}
