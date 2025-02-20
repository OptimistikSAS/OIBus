import path from 'node:path';
import { createReadStream } from 'node:fs';

import NorthConnector from '../north-connector';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { filesExists } from '../../service/utils';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { URL, URLSearchParams } from 'node:url';
import { createProxyAgent } from '../../service/proxy-agent';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthREST extends NorthConnector<NorthRESTSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthRESTSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolders);
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
   * Handle the file by sending it over to the specified endpoint
   */
  async handleFile(filePath: string): Promise<void> {
    let endpoint = this.connector.settings.endpoint;

    if (!(await filesExists(filePath))) {
      throw new Error(`File ${filePath} does not exist`);
    }

    const { base } = path.parse(filePath);
    const readStream = createReadStream(path.resolve(filePath));
    const body = new FormData();
    body.append('file', readStream, { filename: base });

    const queryParams = this.getQueryParams();
    if (queryParams) {
      endpoint += `?${queryParams}`;
    }
    const request = {
      method: 'POST',
      headers: new fetch.Headers(body.getHeaders()),
      body,
      agent: await this.getProxyAgent(endpoint)
    };
    const authHeader = await this.getAuthorizationHeader();
    if (authHeader) {
      request.headers.append('Authorization', authHeader);
    }

    try {
      await fetch(endpoint, request);
    } catch (fetchError) {
      let code: string | undefined;
      if (fetchError instanceof fetch.FetchError) {
        code = fetchError.code;
      }

      throw {
        message: `Fail to reach file endpoint ${endpoint}. ${fetchError}${code ? `, code: ${code}` : ''}`,
        retry: true
      };
    } finally {
      readStream.close();
    }
  }

  override async testConnection(): Promise<void> {
    let { origin } = URL.parse(this.connector.settings.endpoint)!;
    if (origin.endsWith('/')) {
      origin = origin.slice(-1);
    }

    let path = this.connector.settings.testPath;
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    const testEndpoint = `${origin}/${path}`;
    const request = {
      method: 'GET',
      headers: new fetch.Headers(),
      agent: await this.getProxyAgent(testEndpoint)
    };
    const authHeader = await this.getAuthorizationHeader();
    if (authHeader) {
      request.headers.append('Authorization', authHeader);
    }

    let response;
    try {
      response = await fetch(testEndpoint, request);
    } catch (fetchError) {
      let code: string | undefined;
      if (fetchError instanceof fetch.FetchError) {
        code = fetchError.code;
      }
      throw new Error(`Fetch error: ${fetchError}${code ? `, code: ${code}` : ''}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
  }

  private getQueryParams() {
    if (!this.connector.settings.queryParams) return;

    const params: ReadonlyArray<[string, string]> = this.connector.settings.queryParams.map(q => [q.key, q.value]);
    const queryParams = new URLSearchParams(params);

    if (queryParams.size > 0) {
      return queryParams.toString();
    }

    return;
  }

  private async getProxyAgent(targetUrl: string) {
    return createProxyAgent(
      this.connector.settings.useProxy,
      targetUrl,
      this.connector.settings.useProxy
        ? {
            url: this.connector.settings.proxyUrl!,
            username: this.connector.settings.proxyUsername!,
            password: this.connector.settings.proxyPassword
              ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
              : null
          }
        : null,
      true // TODO: accept unauthorized?
    );
  }

  private async getAuthorizationHeader() {
    let header: string;

    switch (this.connector.settings.authType) {
      case 'basic':
        const username = this.connector.settings.basicAuthUsername;
        let password = this.connector.settings.basicAuthPassword;

        if (password) {
          password = await this.encryptionService.decryptText(password);
        } else {
          password = '';
        }
        header = Buffer.from(`${username}:${password}`).toString('base64');
        header = `Basic ${header}`;
        break;

      case 'bearer':
        if (!this.connector.settings.bearerAuthToken) return;

        header = await this.encryptionService.decryptText(this.connector.settings.bearerAuthToken);

        // Make sure to include "Bearer " in front of the token, if the token provided does not have it
        if (!header.startsWith('Bearer ')) {
          header = `Bearer ${header}`;
        }

        break;
    }

    return header;
  }
}
