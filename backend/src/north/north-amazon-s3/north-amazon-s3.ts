import fs from 'node:fs';

import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
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
    encryptionService: EncryptionService,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, encryptionService, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await super.start(dataStream);
    await this.prepareConnection();
  }

  async prepareConnection(): Promise<void> {
    const proxy = createProxyAgent(
      this.connector.settings.useProxy,
      'https://',
      this.connector.settings.useProxy
        ? {
            url: this.connector.settings.proxyUrl!,
            username: this.connector.settings.proxyUsername!,
            password: this.connector.settings.proxyPassword
              ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
              : null
          }
        : null,
      false
    );

    this.s3 = new S3Client({
      region: this.connector.settings.region,
      credentials: {
        accessKeyId: this.connector.settings.accessKey,
        secretAccessKey: this.connector.settings.secretKey
          ? await this.encryptionService.decryptText(this.connector.settings.secretKey)
          : ''
      },
      requestHandler: proxy
        ? new NodeHttpHandler({
            httpAgent: proxy,
            httpsAgent: proxy
          })
        : undefined
    });
  }

  override async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
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
}
