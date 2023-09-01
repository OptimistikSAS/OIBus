import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import fetch from 'node-fetch';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import https from 'node:https';
import { HandlesFile, HandlesValues } from '../north-interface';
import { filesExists } from '../../service/utils';
import { NorthRestAPISettings } from '../../../../shared/model/north-settings.model';
import { createProxyAgent } from '../../service/proxy.service';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class NorthRestApi - Send files through a POST Multipart HTTP request and values as JSON payload
 * Both endpoints are configurable by the user, allowing to send data to any HTTP application
 * To send data to another OIBus, use the following endpoints:
 *  -files endpoint: /engine/addFile
 *  -values endpoint: /engine/addValues
 */
export default class NorthRestApi extends NorthConnector<NorthRestAPISettings> implements HandlesFile, HandlesValues {
  static type = manifest.id;

  private proxyAgent: any | undefined;

  constructor(
    configuration: NorthConnectorDTO<NorthRestAPISettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, repositoryService, logger, baseFolder);
    if (this.connector.settings.host.endsWith('/')) {
      this.connector.settings.host = this.connector.settings.host.slice(0, this.connector.settings.host.length - 1);
    }
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  override async start(): Promise<void> {
    await super.start();

    if (this.connector.settings.useProxy) {
      this.proxyAgent = createProxyAgent(
        {
          url: this.connector.settings.proxyUrl!,
          username: this.connector.settings.proxyUsername!,
          password:
            this.connector.settings.proxyPassword != null
              ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
              : null
        },
        this.connector.settings.acceptUnauthorized
      );
    } else if (this.connector.settings.acceptUnauthorized && this.connector.settings.host.startsWith('https://')) {
      this.proxyAgent = new https.Agent({ rejectUnauthorized: false });
    }
  }

  /**
   * Handle values by sending them to the specified endpoint
   */
  async handleValues(values: Array<OIBusDataValue>): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    switch (this.connector.settings.authentication.type) {
      case 'basic':
        headers.authorization = `Basic ${Buffer.from(
          `${this.connector.settings.authentication.username}:${
            this.connector.settings.authentication.password
              ? await this.encryptionService.decryptText(this.connector.settings.authentication.password)
              : ''
          }`
        ).toString('base64')}`;
        break;

      default:
        break;
    }

    let response;
    const valuesUrl = `${this.connector.settings.host}${this.connector.settings.valuesEndpoint}?name=${this.connector.name}`;
    try {
      response = await fetch(valuesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(values),
        timeout: this.connector.settings.timeout * 1000,
        agent: this.proxyAgent
      });
    } catch (fetchError) {
      throw {
        message: `Fail to reach values endpoint ${valuesUrl}. ${fetchError}`,
        retry: true
      };
    }

    if (!response.ok) {
      throw {
        message: `Error ${response.status}: ${response.statusText}`,
        retry: response.status === 401 || response.status === 403 || response.status === 404 || response.status === 504
      };
    }
  }

  /**
   * Handle the file by sending it to the specified endpoint
   */
  async handleFile(filePath: string): Promise<void> {
    const headers: Record<string, string> = {};
    switch (this.connector.settings.authentication.type) {
      case 'basic':
        headers.authorization = `Basic ${Buffer.from(
          `${this.connector.settings.authentication.username}:${
            this.connector.settings.authentication.password
              ? await this.encryptionService.decryptText(this.connector.settings.authentication.password)
              : ''
          }`
        ).toString('base64')}`;
        break;

      default:
        break;
    }
    if (!(await filesExists(filePath))) {
      throw new Error(`File ${filePath} does not exist`);
    }
    const readStream = createReadStream(filePath);
    // Remove timestamp from the file path
    const { name, ext } = path.parse(filePath);
    const filename = name.slice(0, name.lastIndexOf('-'));

    const body = new FormData();
    body.append('file', readStream, { filename: `${filename}${ext}` });
    const formHeaders = body.getHeaders();
    Object.keys(formHeaders).forEach(key => {
      headers[key] = formHeaders[key];
    });

    let response;
    const fileUrl = `${this.connector.settings.host}${this.connector.settings.fileEndpoint}?name=${this.connector.name}`;
    try {
      response = await fetch(fileUrl, {
        method: 'POST',
        headers,
        body,
        timeout: this.connector.settings.timeout * 1000,
        agent: this.proxyAgent
      });
      readStream.close();
    } catch (fetchError) {
      readStream.close();
      throw {
        message: `Fail to reach file endpoint ${fileUrl}. ${fetchError}`,
        retry: true
      };
    }

    if (!response.ok) {
      throw {
        message: `Error ${response.status}: ${response.statusText}`,
        retry: response.status === 401 || response.status === 403 || response.status === 404 || response.status === 504
      };
    }
  }
}
