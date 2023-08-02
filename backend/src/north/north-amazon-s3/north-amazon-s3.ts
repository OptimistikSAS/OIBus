import fs from 'node:fs';
import path from 'node:path';

import { GetBucketAclCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { HandlesFile } from '../north-interface';
import { NorthAmazonS3Settings } from '../../../../shared/model/north-settings.model';
import { createProxyAgent } from '../../service/proxy.service';

/**
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
export default class NorthAmazonS3 extends NorthConnector<NorthAmazonS3Settings> implements HandlesFile {
  static type = manifest.id;

  private proxyAgent: any | undefined;
  private s3: S3Client | undefined;

  constructor(
    connector: NorthConnectorDTO<NorthAmazonS3Settings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, encryptionService, repositoryService, logger, baseFolder);
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await super.start();
    await this.prepareConnection();
  }

  async prepareConnection(): Promise<void> {
    if (this.connector.settings.useProxy) {
      this.proxyAgent = createProxyAgent(
        {
          url: this.connector.settings.proxyUrl!,
          username: this.connector.settings.proxyUsername!,
          password: this.connector.settings.proxyPassword
            ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
            : null
        },
        false
      );
    }

    this.s3 = new S3Client({
      region: this.connector.settings.region,
      credentials: {
        accessKeyId: this.connector.settings.accessKey,
        secretAccessKey: this.connector.settings.secretKey
          ? await this.encryptionService.decryptText(this.connector.settings.secretKey)
          : ''
      },
      requestHandler: this.proxyAgent ? new NodeHttpHandler({ httpAgent: this.proxyAgent }) : undefined
    });
  }

  /**
   * Handle the file by sending it to AWS S3.
   */
  async handleFile(filePath: string): Promise<void> {
    const params = {
      Bucket: this.connector.settings.bucket,
      Body: fs.createReadStream(filePath),
      Key: `${this.connector.settings.folder}/${this.getFilenameWithoutTimestamp(filePath)}`
    };

    await this.s3!.send(new PutObjectCommand(params));
  }

  /**
   * Get filename without timestamp from file path.
   */
  getFilenameWithoutTimestamp(filePath: string): string {
    const { name, ext } = path.parse(filePath);
    const filename = name.slice(0, name.lastIndexOf('-'));
    return `${filename}${ext}`;
  }

  override async testConnection(): Promise<void> {
    this.logger.info('Testing Amazon S3 connection');
    await this.prepareConnection();

    try {
      const result = await this.s3!.send(
        new GetBucketAclCommand({
          Bucket: this.connector.settings.bucket // required
        })
      );
      this.logger.info(`Access to bucket ${this.connector.settings.bucket} allowed. ${result}`);
    } catch (error) {
      this.logger.error(`Error testing Amazon S3 connection. ${error}`);
      throw new Error(`Error testing Amazon S3 connection. ${error}`);
    }
  }
}
