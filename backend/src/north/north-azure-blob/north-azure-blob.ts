import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import NorthConnector from '../north-connector';
import manifest from '../north-azure-blob/manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import * as process from 'process';
import { HandlesFile } from '../north-interface';
import { NorthAzureBlobSettings } from '../../../../shared/model/north-settings.model';

export default class NorthAzureBlob extends NorthConnector<NorthAzureBlobSettings> implements HandlesFile {
  static type = manifest.id;
  private blobClient: BlobServiceClient | null = null;

  constructor(
    connector: NorthConnectorDTO<NorthAzureBlobSettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, encryptionService, repositoryService, logger, baseFolder);
  }

  async start(): Promise<void> {
    this.logger.info(
      `Connecting to Azure Blob Storage for account ${this.connector.settings.account} and container ${this.connector.settings.container}`
    );
    switch (this.connector.settings.authentication) {
      case 'sasToken':
        this.logger.debug(`Initiate Azure blob service client using ${this.connector.settings.authentication}`);
        const decryptedToken = await this.encryptionService.decryptText(this.connector.settings.sasToken!);
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net?${decryptedToken}`);
        break;
      case 'accessKey':
        this.logger.debug(`Initiate Azure blob service client using ${this.connector.settings.authentication}`);
        const decryptedAccessKey = await this.encryptionService.decryptText(this.connector.settings.accessKey!);
        const sharedKeyCredential = new StorageSharedKeyCredential(this.connector.settings.account!, decryptedAccessKey);
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net`, sharedKeyCredential);
        break;
      case 'aad':
        this.logger.debug(`Initiate Azure blob service client using ${this.connector.settings.authentication}`);
        process.env.AZURE_TENANT_ID = this.connector.settings.tenantId!;
        process.env.AZURE_CLIENT_ID = this.connector.settings.clientId!;
        const decryptedClientSecret = await this.encryptionService.decryptText(this.connector.settings.clientSecret!);
        process.env.AZURE_CLIENT_SECRET = decryptedClientSecret;
        const defaultAzureCredential = new DefaultAzureCredential();
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net`, defaultAzureCredential);
        break;
      default:
        throw new Error(`Authentication "${this.connector.settings.authentication}" not supported for South "${this.connector.name}"`);
    }
  }

  /**
   * Handle the file by uploading it to Azure Blob Storage.
   */
  async handleFile(filePath: string): Promise<void> {
    const container = this.connector.settings.container;
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/` : '';
    this.logger.info(`Uploading file "${filePath}" to Azure Blob Storage for container ${container} and path ${blobPath}`);

    const { name, ext } = path.parse(filePath);
    const filename = name.slice(0, name.lastIndexOf('-'));

    const blobName = `${blobPath}${filename}${ext}`;
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath);

    const containerClient = this.blobClient!.getContainerClient(container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadBlobResponse = await blockBlobClient.upload(content, stats.size);
    this.logger.info(`Upload block blob "${blobName}" successfully with requestId: ${uploadBlobResponse.requestId}`);
  }
}
