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
import { request, ProxyAgent } from 'undici';
import { URL } from 'node:url';

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
    if (!(await filesExists(filePath))) {
      throw new Error(`File ${filePath} does not exist`);
    }

    const endpoint = this.connector.settings.endpoint;

    // Get query params
    const queryParams = this.getQueryParams();

    // Create FormData with file
    const { base } = path.parse(filePath);
    const form = new FormData();
    const fileStream = createReadStream(path.resolve(filePath));
    form.append('file', fileStream, { filename: base });

    const headers: Record<string, string> = form.getHeaders();

    // Get proxy agent if needed
    const proxyAgent = await this.getProxyAgent();

    // Add authorization header if available
    const authHeader = await this.getAuthorizationHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    let response;
    try {
      response = await request(endpoint, {
        method: 'POST',
        headers,
        query: queryParams,
        body: form,
        dispatcher: proxyAgent,
        signal: AbortSignal.timeout(this.connector.settings.timeout * 1000)
      });
    } catch (error) {
      const message = this.getMessageFromError(error);

      throw {
        message: `Failed to reach file endpoint ${endpoint}; ${message}`,
        retry: true
      };
    } finally {
      if (!fileStream.closed) {
        fileStream.close();
      }
    }

    const ok = response.statusCode >= 200 && response.statusCode <= 299;
    if (!ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
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
    const headers: Record<string, string> = {};

    // Get proxy agent if needed
    const proxyAgent = await this.getProxyAgent();

    // Add authorization header if available
    const authHeader = await this.getAuthorizationHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    let response;
    try {
      response = await request(testEndpoint, {
        method: 'GET',
        headers,
        dispatcher: proxyAgent,
        signal: AbortSignal.timeout(this.connector.settings.timeout * 1000)
      });
    } catch (error) {
      const message = this.getMessageFromError(error);
      throw new Error(`Failed to reach file endpoint ${testEndpoint}; ${message}`);
    }

    const ok = response.statusCode >= 200 && response.statusCode <= 299;
    if (!ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
  }

  /**
   * Get query parameters as an object
   */
  private getQueryParams(): Record<string, string> {
    if (!this.connector.settings.queryParams) return {};

    const queryParams: Record<string, string> = {};

    for (const param of this.connector.settings.queryParams) {
      queryParams[param.key] = param.value;
    }

    return queryParams;
  }

  /**
   * Get proxy agent if proxy is enabled
   * @throws Error if no proxy url is specified in settings
   */
  private async getProxyAgent() {
    if (!this.connector.settings.useProxy) {
      return;
    }
    if (!this.connector.settings.proxyUrl) {
      throw new Error(`Proxy URL not specified`);
    }

    const options: ProxyAgent.Options = {
      uri: this.connector.settings.proxyUrl
    };

    if (this.connector.settings.proxyUsername) {
      const username = this.connector.settings.proxyUsername;
      let password = this.connector.settings.proxyPassword;

      if (password) {
        password = await this.encryptionService.decryptText(password);
      } else {
        password = '';
      }

      options.token = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    return new ProxyAgent(options);
  }

  /**
   * Get authorization header based on configured authentication type
   */
  private async getAuthorizationHeader(): Promise<string | undefined> {
    let header: string | undefined = undefined;

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

  /**
   * Convert an unknown request error to a readable message
   */
  private getMessageFromError(error: unknown) {
    if (!(error instanceof Error)) {
      return String(error);
    }

    const errors: Array<Error> = [error];

    if (error instanceof AggregateError) {
      errors.push(...error.errors);
    }

    const messages: Array<string> = [];

    for (const error of errors) {
      let code: string | number | undefined = undefined;
      let message: string | undefined = undefined;

      if (error.message) {
        message = `message: ${error.message}`;
      }

      if ('code' in error && error.code && (typeof error.code === 'string' || typeof error.code === 'number')) {
        code = `code: ${error.code}`;
      }

      messages.push([message, code].filter(Boolean).join(', '));
    }

    return messages.join('; ');
  }
}
