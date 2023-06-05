import NorthConnector from '../north-connector';

import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { createReadStream } from 'node:fs';
import FormData from 'form-data';
import path from 'node:path';
import fetch from 'node-fetch';
import https from 'node:https';
import { HandlesFile, HandlesValues } from '../north-interface';

/**
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector implements HandlesFile, HandlesValues {
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
   * Handle values by sending them to OIAnalytics
   */
  async handleValues(values: Array<any>): Promise<void> {
    // Remove empty values
    const cleanedValues = values
      .filter(
        value => value && value.data && value.data.value !== undefined && value.data.value !== null && value.timestamp && value.pointId
      )
      .map(value => ({
        timestamp: value.timestamp,
        data: value.data,
        pointId: value.pointId
      }));

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
    const valuesUrl = `${this.configuration.settings.host}/api/oianalytics/oibus/time-values?dataSourceId=${this.configuration.name}`;
    try {
      response = await fetch(valuesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanedValues),
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
   * Handle the file by sending it to OIAnalytics.
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
    const fileUrl = `${this.configuration.settings.host}/api/oianalytics/file-uploads?dataSourceId=${this.configuration.name}`;
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
