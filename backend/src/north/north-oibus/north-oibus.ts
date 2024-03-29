import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import { HandlesFile, HandlesValues } from '../north-interface';
import { filesExists } from '../../service/utils';
import { NorthOIBusSettings } from '../../../../shared/model/north-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class NorthOIBus - Send files through a POST Multipart HTTP request and values as JSON payload into another OIBus
 */
export default class NorthOibus extends NorthConnector<NorthOIBusSettings> implements HandlesFile, HandlesValues {
  static type = manifest.id;

  constructor(
    configuration: NorthConnectorDTO<NorthOIBusSettings>,
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

  override async testConnection(): Promise<void> {
    const headers: HeadersInit = {};
    const basic = Buffer.from(
      `${this.connector.settings.username}:${await this.encryptionService.decryptText(this.connector.settings.password!)}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;
    const requestUrl = `${this.connector.settings.host}/api/info`;
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      timeout: this.connector.settings.timeout * 1000,
      agent: createProxyAgent(
        this.connector.settings.useProxy,
        requestUrl,
        this.connector.settings.useProxy
          ? {
              url: this.connector.settings.proxyUrl!,
              username: this.connector.settings.proxyUsername!,
              password: this.connector.settings.proxyPassword
                ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
                : null
            }
          : null,
        this.connector.settings.acceptUnauthorized
      )
    };

    let response;
    try {
      response = await fetch(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
  }

  /**
   * Handle values by sending them to the specified endpoint
   */
  async handleValues(values: Array<OIBusDataValue>): Promise<void> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    headers.authorization = `Basic ${Buffer.from(
      `${this.connector.settings.username}:${await this.encryptionService.decryptText(this.connector.settings.password!)}`
    ).toString('base64')}`;

    let response;
    const valuesUrl = `${this.connector.settings.host}/api/add-values?name=${encodeURI(this.connector.name)}`;
    try {
      response = await fetch(valuesUrl, {
        method: 'POST',
        headers,
        timeout: this.connector.settings.timeout * 1000,
        body: JSON.stringify(values),
        agent: createProxyAgent(
          this.connector.settings.useProxy,
          valuesUrl,
          this.connector.settings.useProxy
            ? {
                url: this.connector.settings.proxyUrl!,
                username: this.connector.settings.proxyUsername!,
                password: this.connector.settings.proxyPassword
                  ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
                  : null
              }
            : null,
          this.connector.settings.acceptUnauthorized
        )
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
    const headers: HeadersInit = {};
    headers.authorization = `Basic ${Buffer.from(
      `${this.connector.settings.username}:${await this.encryptionService.decryptText(this.connector.settings.password!)}`
    ).toString('base64')}`;

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
    const fileUrl = `${this.connector.settings.host}/api/add-file?name=${encodeURI(this.connector.name)}`;
    try {
      response = await fetch(fileUrl, {
        method: 'POST',
        headers,
        timeout: this.connector.settings.timeout * 1000,
        body,
        agent: createProxyAgent(
          this.connector.settings.useProxy,
          fileUrl,
          this.connector.settings.useProxy
            ? {
                url: this.connector.settings.proxyUrl!,
                username: this.connector.settings.proxyUsername!,
                password: this.connector.settings.proxyPassword
                  ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
                  : null
              }
            : null,
          this.connector.settings.acceptUnauthorized
        )
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
