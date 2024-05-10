import fs from 'node:fs';
import path from 'node:path';

import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { NorthAmazonS3Settings } from '../../../../shared/model/north-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusContent, OIBusDataValue } from '../../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import csv from 'papaparse';

/**
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
export default class NorthAmazonS3 extends NorthConnector<NorthAmazonS3Settings> {
  static type = manifest.id;
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
        ? (new NodeHttpHandler({
            httpAgent: proxy,
            httpsAgent: proxy
          }) as any)
        : undefined
    });
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

  async handleValues(values: Array<OIBusDataValue>): Promise<void> {
    const filename = `${this.connector.name}-${DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`;
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
    const params = {
      Bucket: this.connector.settings.bucket,
      Body: csvContent,
      Key: `${this.connector.settings.folder}/${filename}`
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
