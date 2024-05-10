import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import NorthConnector from '../north-connector';
import manifest from '../north-azure-blob/manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import { NorthAzureBlobSettings } from '../../../../shared/model/north-settings.model';
import { OIBusContent } from '../../../../shared/model/engine.model';

const TEST_FILE = 'oibus-azure-test.txt';

export default class NorthAzureBlob extends NorthConnector<NorthAzureBlobSettings> {
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
        const clientSecretCredential = new ClientSecretCredential(
          this.connector.settings.tenantId!,
          this.connector.settings.clientId!,
          await this.encryptionService.decryptText(this.connector.settings.clientSecret!)
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
      default:
        throw new Error(`Authentication "${this.connector.settings.authentication}" not supported for North "${this.connector.name}"`);
    }
  }

  async handleContent(data: OIBusContent): Promise<void> {
    switch (data.type) {
      case 'raw':
        return this.handleFile(data.filePath);

      case 'time-values':
        throw new Error('Can not manage time values');
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

    const blockBlobClient = this.blobClient!.getContainerClient(container).getBlockBlobClient(blobName);
    const uploadBlobResponse = await blockBlobClient.upload(content, stats.size);
    this.logger.info(`Upload block blob "${blobName}" successfully with requestId: ${uploadBlobResponse.requestId}`);
  }

  override async testConnection(): Promise<void> {
    await this.prepareConnection();
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/${TEST_FILE}` : TEST_FILE;

    let result: boolean = false;
    try {
      const blockBlobClient = this.blobClient!.getContainerClient(this.connector.settings.container).getBlockBlobClient(blobPath);
      await blockBlobClient.upload('', 0);
      result = await blockBlobClient.exists();
      try {
        await blockBlobClient.deleteIfExists();
      } catch (deleteError) {
        this.logger.error(`Could not delete file "${blobPath}"`);
      }
    } catch (error: unknown) {
      const errorString = `Connection could not establish. Check path and authentication. ${error}`;
      this.logger.error(errorString);
      throw new Error(errorString);
    }
    if (!result) {
      throw new Error(`Container ${this.connector.settings.container} and path ${blobPath} does not exist`);
    }
  }
}
