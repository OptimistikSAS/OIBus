import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import NorthConnector from '../north-connector';
import manifest from '../north-azure-blob/manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import * as process from 'process';
import { HandlesFile } from '../north-interface';

export default class NorthAzureBlob extends NorthConnector implements HandlesFile {
  static category = manifest.category;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder, manifest);
  }

  /**
   * Handle the file by uploading it to Azure Blob Storage.
   */
  async handleFile(filePath: string): Promise<void> {
    this.logger.info(`Uploading file "${filePath}" to Azure Blob Storage`);

    let blobServiceClient: BlobServiceClient | null = null;
    switch (this.configuration.settings.authentication) {
      case 'sasToken':
        this.logger.debug(`Initiate Azure blob service client using ${this.configuration.settings.authentication}`);
        blobServiceClient = new BlobServiceClient(
          `https://${this.configuration.settings.account}.blob.core.windows.net${this.configuration.settings.sasToken}`
        );
        break;
      case 'accessKey':
        this.logger.debug(`Initiate Azure blob service client using ${this.configuration.settings.authentication}`);
        const sharedKeyCredential = new StorageSharedKeyCredential(
          this.configuration.settings.account,
          this.configuration.settings.accessKey
        );
        blobServiceClient = new BlobServiceClient(
          `https://${this.configuration.settings.account}.blob.core.windows.net`,
          sharedKeyCredential
        );
        break;
      case 'aad':
        this.logger.debug(`Initiate Azure blob service client using ${this.configuration.settings.authentication}`);
        process.env.AZURE_TENANT_ID = this.configuration.settings.tenantId;
        process.env.AZURE_CLIENT_ID = this.configuration.settings.clientId;
        process.env.AZURE_CLIENT_SECRET = this.configuration.settings.clientSecret;
        const defaultAzureCredential = new DefaultAzureCredential();
        blobServiceClient = new BlobServiceClient(
          `https://${this.configuration.settings.account}.blob.core.windows.net`,
          defaultAzureCredential
        );
        break;
      default:
        throw new Error(
          `Authentication "${this.configuration.settings.authentication}" not supported for South "${this.configuration.name}"`
        );
    }

    const filenameInfo = path.parse(filePath);
    const blobName = filenameInfo.name + filenameInfo.ext;
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath);

    const containerClient = blobServiceClient.getContainerClient(this.configuration.settings.container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadBlobResponse = await blockBlobClient.upload(content, stats.size);
    this.logger.info(`Upload block blob "${blobName}" successfully with requestId: ${uploadBlobResponse.requestId}`);
  }
}
