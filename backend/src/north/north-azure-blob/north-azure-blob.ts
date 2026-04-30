import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { DataLakeServiceClient, StorageSharedKeyCredential as DataLakeStorageSharedKeyCredential } from '@azure/storage-file-datalake';
import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
import { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type { ProxySettings } from '@azure/core-rest-pipeline/dist/browser';
import CacheService from '../../service/cache/cache.service';
import { ReadStream } from 'node:fs';
import type { ILogger } from '../../model/logger.model';

const TEST_FILE = 'oibus-azure-test.txt';

export default class NorthAzureBlob extends NorthConnector<NorthAzureBlobSettings> {
  private blobClient: BlobServiceClient | null = null;
  private dataLakeClient: DataLakeServiceClient | null = null;

  constructor(connector: NorthConnectorEntity<NorthAzureBlobSettings>, logger: ILogger, cacheService: CacheService) {
    super(connector, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any'];
  }

  async start(): Promise<void> {
    await super.start();
    await this.prepareConnection(this.connector.settings);
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    await this.prepareConnection(this.connector.settings);
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/${TEST_FILE}` : TEST_FILE;

    let testSuccess;
    if (this.connector.settings.useADLS) {
      const fileSystemClient = this.dataLakeClient!.getFileSystemClient(this.connector.settings.container);
      const fileClient = fileSystemClient.getFileClient(blobPath);
      await fileClient.createIfNotExists();
      testSuccess = await fileClient.exists();
      try {
        await fileClient.delete();
      } catch (error: unknown) {
        this.logger.error(`Could not delete file "${blobPath}": ${(error as Error).message}`);
      }
    } else {
      const blockBlobClient = this.blobClient!.getContainerClient(this.connector.settings.container).getBlockBlobClient(blobPath);
      await blockBlobClient.upload('', 0);
      testSuccess = await blockBlobClient.exists();
      try {
        await blockBlobClient.deleteIfExists();
      } catch (error: unknown) {
        this.logger.error(`Could not delete file "${blobPath}": ${(error as Error).message}`);
      }
    }
    if (!testSuccess) {
      throw new Error(`Container ${this.connector.settings.container} and path "${blobPath}" does not exist`);
    }
    return {
      items: [
        { key: 'Account', value: this.connector.settings.account ?? '' },
        { key: 'Container', value: this.connector.settings.container },
        { key: 'Storage Type', value: this.connector.settings.useADLS ? 'Azure Data Lake Storage' : 'Azure Blob Storage' }
      ]
    };
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

  async prepareConnection(settings: NorthAzureBlobSettings): Promise<void> {
    this.logger.info(
      `Connecting to ${settings.useADLS ? 'Azure Data Lake Storage' : 'Azure Blob Storage'} for the account ${settings.account} and the container ${settings.container} using ${settings.authentication} authentication`
    );
    let proxyOptions: ProxySettings | undefined = undefined;
    if (settings.useProxy) {
      const { proxyHost, proxyPort } = this.parseProxyUrl(settings.proxyUrl!);
      proxyOptions = {
        host: proxyHost,
        port: proxyPort,
        username: settings.proxyUsername || undefined,
        password: (await encryptionService.decryptText(settings.proxyPassword)) || undefined
      };
    }
    const url = settings.useADLS
      ? settings.useCustomUrl
        ? `${settings.customUrl}`
        : `https://${settings.account}.dfs.core.windows.net`
      : settings.useCustomUrl
        ? `${settings.customUrl}`
        : `https://${settings.account}.blob.core.windows.net`;
    switch (settings.authentication) {
      case 'sas-token':
        const decryptedToken = await encryptionService.decryptText(settings.sasToken!);
        if (settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(`${url}?${decryptedToken}`, undefined, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(`${url}?${decryptedToken}`, undefined, { proxyOptions });
        }
        break;
      case 'access-key':
        const decryptedAccessKey = await encryptionService.decryptText(settings.accessKey!);
        if (settings.useADLS) {
          const dataLakeSharedKeyCredential = new DataLakeStorageSharedKeyCredential(settings.account!, decryptedAccessKey);
          this.dataLakeClient = new DataLakeServiceClient(url, dataLakeSharedKeyCredential, {
            proxyOptions
          });
        } else {
          const blobSharedKeyCredential = new StorageSharedKeyCredential(settings.account!, decryptedAccessKey);
          this.blobClient = new BlobServiceClient(url, blobSharedKeyCredential, {
            proxyOptions
          });
        }
        break;
      case 'aad':
        const clientSecretCredential = new ClientSecretCredential(
          settings.tenantId!,
          settings.clientId!,
          await encryptionService.decryptText(settings.clientSecret!)
        );
        if (settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(url, clientSecretCredential, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(url, clientSecretCredential, { proxyOptions });
        }
        break;
      case 'external':
        const externalAzureCredential = new DefaultAzureCredential();
        if (settings.useADLS) {
          this.dataLakeClient = new DataLakeServiceClient(url, externalAzureCredential, { proxyOptions });
        } else {
          this.blobClient = new BlobServiceClient(url, externalAzureCredential, { proxyOptions });
        }
        break;
    }
  }

  /**
   * Handle the file by uploading it to Azure Blob Storage.
   */
  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const container = this.connector.settings.container;
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/` : '';
    this.logger.info(
      `Uploading file "${cacheMetadata.contentFile}" to ${this.connector.settings.useADLS ? 'Azure Data Lake Storage' : 'Azure Blob Storage'}  for container ${container} and path ${blobPath}.`
    );
    const blobName = `${blobPath}${cacheMetadata.contentFile}`;

    if (this.connector.settings.useADLS) {
      const fileSystemClient = this.dataLakeClient!.getFileSystemClient(container);
      const fileClient = fileSystemClient.getFileClient(blobName);
      let requestId = (await fileClient.createIfNotExists()).requestId;
      if (cacheMetadata.contentSize !== 0) {
        await fileClient.append(fileStream, 0, cacheMetadata.contentSize);
        requestId = (await fileClient.flush(cacheMetadata.contentSize)).requestId;
      }
      this.logger.info(`Uploaded successfully "${blobName}" to Azure Data Lake Storage with requestId: ${requestId}`);
    } else {
      const blockBlobClient = this.blobClient!.getContainerClient(container).getBlockBlobClient(blobName);
      const uploadBlobResponse = await blockBlobClient.upload(fileStream, cacheMetadata.contentSize);
      this.logger.info(`Uploaded successfully "${blobName}" to Azure Blob Storage with requestId: ${uploadBlobResponse.requestId}`);
    }
  }
}
