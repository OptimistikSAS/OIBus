import fs from 'node:fs';
import path from 'node:path';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { HandlesFile } from '../north-interface';

/**
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
export default class NorthAmazonS3 extends NorthConnector implements HandlesFile {
  static category = manifest.category;

  private proxyAgent: any | undefined;
  private s3: S3Client | undefined;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder, manifest);
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await super.start();

    if (this.configuration.settings.proxyId) {
      this.proxyAgent = await this.proxyService.createProxyAgent(this.configuration.settings.proxyId);
    }

    this.s3 = new S3Client({
      region: this.configuration.settings.region,
      credentials: {
        accessKeyId: this.configuration.settings.authentication.key,
        secretAccessKey: await this.encryptionService.decryptText(this.configuration.settings.authentication.secret)
      },
      requestHandler: this.proxyAgent ? new NodeHttpHandler({ httpAgent: this.proxyAgent }) : undefined
    });
  }

  /**
   * Handle the file by sending it to AWS S3.
   */
  async handleFile(filePath: string): Promise<void> {
    const params = {
      Bucket: this.configuration.settings.bucket,
      Body: fs.createReadStream(filePath),
      Key: `${this.configuration.settings.folder}/${this.getFilenameWithoutTimestamp(filePath)}`
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
}
