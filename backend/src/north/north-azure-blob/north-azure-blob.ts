import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { AzurePowerShellCredential, ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import NorthConnector from '../north-connector';
import manifest from '../north-azure-blob/manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
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
    await super.start();
    await this.prepareConnection();
  }

  async prepareConnection(): Promise<void> {
    this.logger.info(
      `Connecting to Azure Blob Storage for account ${this.connector.settings.account} and container ${this.connector.settings.container} with authentication ${this.connector.settings.authentication}`
    );
    switch (this.connector.settings.authentication) {
      case 'sasToken':
        const decryptedToken = await this.encryptionService.decryptText(this.connector.settings.sasToken!);
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net?${decryptedToken}`);
        break;
      case 'accessKey':
        const decryptedAccessKey = await this.encryptionService.decryptText(this.connector.settings.accessKey!);
        const sharedKeyCredential = new StorageSharedKeyCredential(this.connector.settings.account!, decryptedAccessKey);
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net`, sharedKeyCredential);
        break;
      case 'aad':
        const decryptedClientSecret = await this.encryptionService.decryptText(this.connector.settings.clientSecret!);
        const clientSecretCredential = new ClientSecretCredential(
          this.connector.settings.tenantId!,
          this.connector.settings.clientId!,
          decryptedClientSecret
        );
        this.blobClient = new BlobServiceClient(`https://${this.connector.settings.account}.blob.core.windows.net`, clientSecretCredential);
        break;
      case 'external':
        const externalAzureCredential = new DefaultAzureCredential();
        this.blobClient = new BlobServiceClient(
          `https://${this.connector.settings.account}.blob.core.windows.net`,
          externalAzureCredential
        );
        break;
      case 'powershell':
        this.blobClient = new BlobServiceClient(
          `https://${this.connector.settings.account}.blob.core.windows.net`,
          new AzurePowerShellCredential()
        );
        break;
      default:
        throw new Error(`Authentication "${this.connector.settings.authentication}" not supported for North "${this.connector.name}"`);
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

  override async testConnection(): Promise<void> {
    this.logger.info('Testing Azure Blob connection');
    await this.prepareConnection();

    let result = false;
    try {
      result = await this.blobClient!.getContainerClient(this.connector.settings.container).exists();
    } catch (error) {
      this.logger.error(`Error testing Azure Blob connection. ${error}`);
      throw error;
    }
    if (result) {
      this.logger.info(`Access to container ${this.connector.settings.container} ok`);
    } else {
      throw new Error(`Container ${this.connector.settings.container} does not exist`);
    }
  }
}
