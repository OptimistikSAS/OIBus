import { ReadStream } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pino from 'pino';
import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
import { NorthAmazonS3Settings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CacheService from '../../service/cache/cache.service';

/**
 * Class NorthAmazonS3 - sends files to Amazon AWS S3
 */
export default class NorthAmazonS3 extends NorthConnector<NorthAmazonS3Settings> {
  private s3: S3Client | undefined;

  constructor(connector: NorthConnectorEntity<NorthAmazonS3Settings>, logger: pino.Logger, cacheService: CacheService) {
    super(connector, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any'];
  }

  async start(): Promise<void> {
    await super.start();
    await this.prepareConnection(this.connector.settings);
  }

  async testConnection(): Promise<void> {
    await this.prepareConnection(this.connector.settings);

    try {
      await this.s3!.send(
        new HeadBucketCommand({
          Bucket: this.connector.settings.bucket
        })
      );
      this.logger.info(`Access to bucket "${this.connector.settings.bucket}" allowed`);
    } catch (error: unknown) {
      throw new Error(`Error testing Amazon S3 connection: ${(error as Error).message}`);
    }
  }

  override async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const params = {
      Bucket: this.connector.settings.bucket,
      Body: fileStream,
      Key: `${this.connector.settings.folder}/${cacheMetadata.contentFile}`
    };
    await this.s3!.send(new PutObjectCommand(params));
  }

  async prepareConnection(settings: NorthAmazonS3Settings): Promise<void> {
    let proxyAgent;
    if (settings.useProxy) {
      let proxyUrl = settings.proxyUrl!;
      if (settings.proxyUsername && settings.proxyPassword) {
        // Insert username and password into the proxy URL
        const url = new URL(proxyUrl);
        url.username = settings.proxyUsername;
        url.password = await encryptionService.decryptText(settings.proxyPassword);
        proxyUrl = url.toString();
      }
      proxyAgent = new HttpsProxyAgent(proxyUrl);
    }

    this.s3 = new S3Client({
      region: settings.region,
      credentials: {
        accessKeyId: settings.accessKey,
        secretAccessKey: await encryptionService.decryptText(settings.secretKey)
      },
      requestHandler: proxyAgent
        ? new NodeHttpHandler({
            httpsAgent: proxyAgent
          })
        : undefined
    });
  }
}
