import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import fetch from 'node-fetch';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import https from 'node:https';
import { HandlesFile, HandlesValues } from '../north-interface';

/**
 * Class NorthOIConnect - Send files through a POST Multipart HTTP request and values as JSON payload
 * Both endpoints are configurable by the user, allowing to send data to any HTTP application
 * To send data to another OIBus, use the following endpoints:
 *  -files endpoint: /engine/addFile
 *  -values endpoint: /engine/addValues
 */
export default class NorthOIConnect extends NorthConnector implements HandlesFile, HandlesValues {
  static category = manifest.category;

  private proxyAgent: any | undefined;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder);
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  override async start(): Promise<void> {
    await super.start();

    if (this.configuration.settings.proxyId) {
      this.proxyAgent = await this.proxyService.createProxyAgent(
        this.configuration.settings.proxyId,
        this.configuration.settings.acceptUnauthorized
      );
    } else if (this.configuration.settings.acceptUnauthorized && this.configuration.settings.host.startsWith('https://')) {
      this.proxyAgent = new https.Agent({ rejectUnauthorized: false });
    }
  }

  /**
   * Handle values by sending them to the specified endpoint
   */
  async handleValues(values: Array<any>): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    switch (this.configuration.settings.authentication.type) {
      case 'basic':
        headers.authorization = `Basic ${Buffer.from(
          `${this.configuration.settings.authentication.username}:${
            this.configuration.settings.authentication.password
              ? await this.encryptionService.decryptText(this.configuration.settings.authentication.password)
              : ''
          }`
        ).toString('base64')}`;
        break;

      default:
        break;
    }

    let response;
    const valuesUrl = `${this.configuration.settings.host}${this.configuration.settings.valuesEndpoint}?name=${this.configuration.name}`;
    try {
      response = await fetch(valuesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(values),
        timeout: this.configuration.settings.timeout * 1000,
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
    switch (this.configuration.settings.authentication.type) {
      case 'basic':
        headers.authorization = `Basic ${Buffer.from(
          `${this.configuration.settings.authentication.username}:${
            this.configuration.settings.authentication.password
              ? await this.encryptionService.decryptText(this.configuration.settings.authentication.password)
              : ''
          }`
        ).toString('base64')}`;
        break;

      default:
        break;
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
    const fileUrl = `${this.configuration.settings.host}${this.configuration.settings.fileEndpoint}?name=${this.configuration.name}`;
    try {
      response = await fetch(fileUrl, {
        method: 'POST',
        headers,
        body,
        timeout: this.configuration.settings.timeout * 1000,
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
