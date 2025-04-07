import fs from 'node:fs/promises';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { DataLakeServiceClient, StorageSharedKeyCredential as DataLakeStorageSharedKeyCredential } from '@azure/storage-file-datalake';
import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import { getFilenameWithoutRandomId } from '../../service/utils';
import type { ProxySettings } from '@azure/core-rest-pipeline/dist/browser';

const TEST_FILE = 'oibus-azure-test.txt';

export default class NorthAzureBlob extends NorthConnector<NorthAzureBlobSettings> {
  private blobClient: BlobServiceClient | null = null;
  private dataLakeClient: DataLakeServiceClient | null = null;

  constructor(
    connector: NorthConnectorEntity<NorthAzureBlobSettings>,
    encryptionService: EncryptionService,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, encryptionService, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async start(dataStream = true): Promise<void> {
    await super.start(dataStream);
    await this.prepareConnection();
  }

  parseProxyUrl(url: string): { proxyHost: string; proxyPort: number } {
    const splitUrl = url.split(':');
    if (splitUrl.length === 1) {
      return { proxyHost: splitUrl[0], proxyPort: 80 };
    } else if (splitUrl.length === 2) {
      if (splitUrl[0].startsWith('https')) {
        // case https://1.2.3.4
        return { proxyHost: url, proxyPort: 443 };
      } else if (splitUrl[0].startsWith('http')) {
        // case http://1.2.3.4
        return { proxyHost: url, proxyPort: 80 };
      } else {
        // case 1.2.3.4:3198
        return { proxyHost: `http://${splitUrl[0]}`, proxyPort: parseInt(splitUrl[1]) };
      }
    } else if (splitUrl.length === 3) {
      // case http://1.2.3.4:8080
      return { proxyHost: `${splitUrl[0]}:${splitUrl[1]}`, proxyPort: parseInt(splitUrl[2]) };
    } else {
      throw new Error(`Bad proxy url ${url}`);
    }
  }

  async prepareConnection(): Promise<void> {
    this.logger.info(
      `Connecting to ${this.connector.settings.useADLS ? 'Azure Data Lake Storage' : 'Azure Blob Storage'} for the account ${this.connector.settings.account} and the container ${this.connector.settings.container} using ${this.connector.settings.authentication} authentication.`
    );
    let proxyOptions: ProxySettings | undefined = undefined;
    if (this.connector.settings.useProxy) {
      const { proxyHost, proxyPort } = this.parseProxyUrl(this.connector.settings.proxyUrl!);
      proxyOptions = {
        host: proxyHost,
        port: proxyPort,
        username: this.connector.settings.proxyUsername || undefined,
        password: this.connector.settings.proxyPassword
          ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
          : undefined
      };
    }
    const url = this.connector.settings.useADLS
      ? this.connector.settings.useCustomUrl
        ? `${this.connector.settings.customUrl}`
        : `https://${this.connector.settings.account}.dfs.core.windows.net`
      : this.connector.settings.useCustomUrl
        ? `${this.connector.settings.customUrl}`
        : `https://${this.connector.settings.account}.blob.core.windows.net`;
    switch (this.connector.settings.authentication) {
      case 'sas-token':
        const decryptedToken = await this.encryptionService.decryptText(this.connector.settings.sasToken!);
        if (this.connector.settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(`${url}?${decryptedToken}`, undefined, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(`${url}?${decryptedToken}`, undefined, { proxyOptions });
        }
        break;
      case 'access-key':
        const decryptedAccessKey = await this.encryptionService.decryptText(this.connector.settings.accessKey!);
        if (this.connector.settings.useADLS) {
          const dataLakeSharedKeyCredential = new DataLakeStorageSharedKeyCredential(this.connector.settings.account!, decryptedAccessKey);
          this.dataLakeClient = new DataLakeServiceClient(url, dataLakeSharedKeyCredential, {
            proxyOptions
          });
        } else {
          const blobSharedKeyCredential = new StorageSharedKeyCredential(this.connector.settings.account!, decryptedAccessKey);
          this.blobClient = new BlobServiceClient(url, blobSharedKeyCredential, {
            proxyOptions
          });
        }
        break;
      case 'aad':
        const clientSecretCredential = new ClientSecretCredential(
          this.connector.settings.tenantId!,
          this.connector.settings.clientId!,
          await this.encryptionService.decryptText(this.connector.settings.clientSecret!)
        );
        if (this.connector.settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(url, clientSecretCredential, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(url, clientSecretCredential, { proxyOptions });
        }
        break;
      case 'external':
        const externalAzureCredential = new DefaultAzureCredential();
        if (this.connector.settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(url, externalAzureCredential, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(url, externalAzureCredential, { proxyOptions });
        }
        break;
      default:
        throw new Error(`Authentication "${this.connector.settings.authentication}" not supported for North "${this.connector.name}"`);
    }
  }

  /**
   * Handle the file by uploading it to Azure Blob Storage.
   */
  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    const container = this.connector.settings.container;
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/` : '';
    this.logger.info(
      `Uploading file "${cacheMetadata.contentFile}" to ${this.connector.settings.useADLS ? 'Azure Data Lake Storage' : 'Azure Blob Storage'}  for container ${container} and path ${blobPath}.`
    );
    const blobName = `${blobPath}${getFilenameWithoutRandomId(cacheMetadata.contentFile)}`;
    const stats = await fs.stat(cacheMetadata.contentFile);
    const content = await fs.readFile(cacheMetadata.contentFile);

    if (this.connector.settings.useADLS) {
      const fileSystemClient = this.dataLakeClient!.getFileSystemClient(container);
      const fileClient = fileSystemClient.getFileClient(blobName);
      let requestId = (await fileClient.createIfNotExists()).requestId;
      if (content.length !== 0) {
        await fileClient.append(content, 0, content.length);
        requestId = (await fileClient.flush(content.length)).requestId;
      }
      this.logger.info(`Uploaded successfully "${blobName}" to Azure Data Lake Storage with requestId: ${requestId}.`);
    } else {
      const blockBlobClient = this.blobClient!.getContainerClient(container).getBlockBlobClient(blobName);
      const uploadBlobResponse = await blockBlobClient.upload(content, stats.size);
      this.logger.info(`Upload block blob "${blobName}" successfully with requestId: ${uploadBlobResponse.requestId}`);
    }
  }

  override async testConnection(): Promise<void> {
    await this.prepareConnection();
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/${TEST_FILE}` : TEST_FILE;

    let result = false;
    try {
      if (this.connector.settings.useADLS) {
        const fileSystemClient = this.dataLakeClient!.getFileSystemClient(this.connector.settings.container);
        const fileClient = fileSystemClient.getFileClient(blobPath);
        await fileClient.createIfNotExists();
        result = await fileClient.exists();
        try {
          await fileClient.delete();
        } catch {
          this.logger.error(`Could not delete file "${blobPath}"`);
        }
      } else {
        const blockBlobClient = this.blobClient!.getContainerClient(this.connector.settings.container).getBlockBlobClient(blobPath);
        await blockBlobClient.upload('', 0);
        result = await blockBlobClient.exists();
        try {
          await blockBlobClient.deleteIfExists();
        } catch {
          this.logger.error(`Could not delete file "${blobPath}"`);
        }
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
