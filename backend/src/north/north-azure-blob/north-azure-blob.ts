import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import { NorthAzureBlobSettings } from '../../../shared/model/north-settings.model';
import { ProxyOptions } from '@azure/core-http';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

const TEST_FILE = 'oibus-azure-test.txt';

export default class NorthAzureBlob extends NorthConnector<NorthAzureBlobSettings> {
  private blobClient: BlobServiceClient | null = null;

  constructor(
    connector: NorthConnectorEntity<NorthAzureBlobSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolder);
  }

  async start(): Promise<void> {
    await super.start();
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
      `Connecting to Azure Blob Storage for account ${this.connector.settings.account} and container ${this.connector.settings.container} with authentication ${this.connector.settings.authentication}`
    );
    let proxyOptions: ProxyOptions | undefined = undefined;
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
    const url = this.connector.settings.useCustomUrl
      ? `${this.connector.settings.customUrl}`
      : `https://${this.connector.settings.account}.blob.core.windows.net`;
    switch (this.connector.settings.authentication) {
      case 'sasToken':
        const decryptedToken = await this.encryptionService.decryptText(this.connector.settings.sasToken!);
        this.blobClient = new BlobServiceClient(`${url}?${decryptedToken}`, undefined, { proxyOptions });
        break;
      case 'accessKey':
        const decryptedAccessKey = await this.encryptionService.decryptText(this.connector.settings.accessKey!);
        const sharedKeyCredential = new StorageSharedKeyCredential(this.connector.settings.account!, decryptedAccessKey);
        this.blobClient = new BlobServiceClient(url, sharedKeyCredential, {
          proxyOptions
        });
        break;
      case 'aad':
        const clientSecretCredential = new ClientSecretCredential(
          this.connector.settings.tenantId!,
          this.connector.settings.clientId!,
          await this.encryptionService.decryptText(this.connector.settings.clientSecret!)
        );
        this.blobClient = new BlobServiceClient(url, clientSecretCredential, { proxyOptions });
        break;
      case 'external':
        const externalAzureCredential = new DefaultAzureCredential();
        this.blobClient = new BlobServiceClient(url, externalAzureCredential, { proxyOptions });
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

  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    const filename = `${this.connector.name}-${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`;
    const container = this.connector.settings.container;
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/${filename}` : filename;

    this.logger.info(`Uploading file "${filename}" to Azure Blob Storage for container ${container} and path ${blobPath}`);

    const csvContent = csv.unparse(
      values.map(value => ({
        pointId: value.pointId,
        timestamp: value.timestamp,
        value: value.data.value
      })),
      {
        header: true,
        delimiter: ';'
      }
    );
    const blockBlobClient = this.blobClient!.getContainerClient(container).getBlockBlobClient(blobPath);
    const uploadBlobResponse = await blockBlobClient.upload(csvContent, csvContent.length);
    this.logger.info(`Upload block blob "${blobPath}" successfully with requestId: ${uploadBlobResponse.requestId}`);
  }

  override async testConnection(): Promise<void> {
    await this.prepareConnection();
    const blobPath = this.connector.settings.path ? `${this.connector.settings.path}/${TEST_FILE}` : TEST_FILE;

    let result = false;
    try {
      const blockBlobClient = this.blobClient!.getContainerClient(this.connector.settings.container).getBlockBlobClient(blobPath);
      await blockBlobClient.upload('', 0);
      result = await blockBlobClient.exists();
      try {
        await blockBlobClient.deleteIfExists();
      } catch {
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
