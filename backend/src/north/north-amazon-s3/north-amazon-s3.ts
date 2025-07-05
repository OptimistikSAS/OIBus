import fs from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
import pino from 'pino';
import { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { getFilenameWithoutRandomId } from '../../service/utils';
import TransformerService from '../../service/transformer.service';

/**
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
export default class NorthAmazonS3 extends NorthConnector<NorthAmazonS3Settings> {
  private s3: S3Client | undefined;

  constructor(
    connector: NorthConnectorEntity<NorthAmazonS3Settings>,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await super.start(dataStream);
    await this.prepareConnection();
  }

  async prepareConnection(): Promise<void> {
    let proxyAgent;
    if (this.connector.settings.useProxy) {
      let proxyUrl = this.connector.settings.proxyUrl!;
      if (this.connector.settings.proxyUsername && this.connector.settings.proxyPassword) {
        // Insert username and password into the proxy URL
        const url = new URL(proxyUrl);
        url.username = this.connector.settings.proxyUsername;
        url.password = await encryptionService.decryptText(this.connector.settings.proxyPassword);
        proxyUrl = url.toString();
      }
      proxyAgent = new HttpsProxyAgent(proxyUrl);
    }

    this.s3 = new S3Client({
      region: this.connector.settings.region,
      credentials: {
        accessKeyId: this.connector.settings.accessKey,
        secretAccessKey: this.connector.settings.secretKey ? await encryptionService.decryptText(this.connector.settings.secretKey) : ''
      },
      requestHandler: proxyAgent
        ? new NodeHttpHandler({
            httpsAgent: proxyAgent
          })
        : undefined
    });
  }

  override async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    const params = {
      Bucket: this.connector.settings.bucket,
      Body: fs.createReadStream(cacheMetadata.contentFile),
      Key: `${this.connector.settings.folder}/${getFilenameWithoutRandomId(cacheMetadata.contentFile)}`
    };

    await this.s3!.send(new PutObjectCommand(params));
  }

  override async testConnection(): Promise<void> {
    await this.prepareConnection();

    try {
      const result = await this.s3!.send(
        new HeadBucketCommand({
          Bucket: this.connector.settings.bucket // required
        })
      );
      this.logger.info(`Access to bucket ${this.connector.settings.bucket} allowed. ${JSON.stringify(result)}`);
    } catch (error) {
      throw new Error(`Error testing Amazon S3 connection. ${error}`);
    }
  }

  supportedTypes(): Array<string> {
    return ['any'];
  }
}
