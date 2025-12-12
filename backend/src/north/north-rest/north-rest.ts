import path from 'node:path';
import { createReadStream, ReadStream } from 'node:fs';

import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { filesExists } from '../../service/utils';
import FormData from 'form-data';
import { URL } from 'node:url';
import { OIBusError } from '../../model/engine.model';
import {
  HTTPRequest,
  ReqAuthOptions,
  ReqOptions,
  ReqProxyOptions,
  ReqResponse,
  retryableHttpStatusCodes
} from '../../service/http-request.utils';
import CacheService from '../../service/cache/cache.service';
import { encryptionService } from '../../service/encryption.service';
import { UndiciHeaders } from 'undici/types/dispatcher';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthREST extends NorthConnector<NorthRESTSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthRESTSettings>,
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService
  ) {
    super(configuration, logger, cacheFolderPath, cacheService);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }

    switch (cacheMetadata.contentType) {
      case 'any':
        return this.handleFile(cacheMetadata.contentFile);
    }
  }

  /**
   * Handle the file by sending it over to the specified endpoint
   */
  async handleFile(filePath: string): Promise<void> {
    const host = this.connector.settings.host;
    const requestUrl = new URL(this.connector.settings.endpoint, host);
    filePath = path.resolve(filePath);

    if (!(await filesExists(filePath))) {
      throw new OIBusError(`File ${filePath} does not exist`, false);
    }

    const endpoint = new URL(this.connector.settings.endpoint, this.connector.settings.host);

    const query: Record<string, string | number> = {};
    for (const queryParam of this.connector.settings.queryParams) {
      query[queryParam.key] = queryParam.value;
    }

    let headers: UndiciHeaders = {};
    let body: FormData | ReadStream;
    const fileStream = createReadStream(filePath);

    if (this.connector.settings.sendAs === 'file') {
      // Create FormData with file
      const form = new FormData();
      form.append('file', fileStream, { filename: path.parse(filePath).base });
      headers = form.getHeaders();
      body = form;
    } else {
      body = fileStream;
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.json':
          headers['content-type'] = 'application/json';
          break;
        case '.xml':
          headers['content-type'] = 'application/xml';
          break;
        case '.txt':
          headers['content-type'] = 'text/plain';
          break;
        case '.csv':
          headers['content-type'] = 'text/csv';
          break;
      }
    }

    for (const header of this.connector.settings.headers) {
      headers[header.key] = header.value;
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions();
    const fetchOptions: ReqOptions = {
      method: this.connector.settings.method,
      query,
      body,
      headers: headers,
      auth: await this.getAuthorizationOptions(),
      proxy,
      timeout: this.connector.settings.timeout * 1000,
      acceptUnauthorized
    };

    await this.handleApiKeyAuth(fetchOptions, requestUrl);

    let response: ReqResponse;
    try {
      response = await HTTPRequest(requestUrl, fetchOptions);
      if (!fileStream.closed) {
        fileStream.close();
      }
    } catch (error) {
      const message = this.getMessageFromError(error);
      if (!fileStream.closed) {
        fileStream.close();
      }
      throw new OIBusError(`Failed to reach file endpoint ${endpoint}; ${message}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }

  override async testConnection(): Promise<void> {
    const host = this.connector.settings.host;
    const testEndpoint = this.connector.settings.test.testEndpoint;
    const testMethod = this.connector.settings.test.testMethod;
    const successCode = this.connector.settings.test.testSuccessCode;

    const requestUrl = new URL(testEndpoint, host);

    let response: ReqResponse;
    try {
      const { proxy, acceptUnauthorized } = this.getProxyOptions();
      const fetchOptions: ReqOptions = {
        method: testMethod,
        auth: await this.getAuthorizationOptions(),
        proxy,
        timeout: this.connector.settings.timeout * 1000,
        acceptUnauthorized,
        body: this.connector.settings.test.body && ['POST', 'PUT'].includes(testMethod) ? this.connector.settings.test.body : undefined
      };

      await this.handleApiKeyAuth(fetchOptions, requestUrl);

      response = await HTTPRequest(requestUrl, fetchOptions);
    } catch (error: unknown) {
      throw new Error(`Fetch error: ${(error as Error).message}`);
    }

    if (response.statusCode !== successCode) {
      throw new Error(
        `HTTP request failed with status code ${response.statusCode}, expected ${successCode}. Message: ${await response.body.text()}`
      );
    }
  }

  private getProxyOptions(): { proxy: ReqProxyOptions | undefined; acceptUnauthorized: boolean } {
    const settings = this.connector.settings;

    if (!settings.proxy.useProxy) {
      return { proxy: undefined, acceptUnauthorized: settings.acceptUnauthorized };
    }
    if (!settings.proxy.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: settings.proxy.proxyUrl
    };

    if (settings.proxy.proxyUsername) {
      options.auth = {
        type: 'url',
        username: settings.proxy.proxyUsername,
        password: settings.proxy.proxyPassword
      };
    }

    return { proxy: options, acceptUnauthorized: settings.acceptUnauthorized };
  }

  private async getAuthorizationOptions(): Promise<ReqAuthOptions | undefined> {
    const settings = this.connector.settings;

    switch (settings.authentication.type) {
      case 'basic': {
        if (!settings.authentication.username) return;

        return {
          type: 'basic',
          username: settings.authentication.username,
          password: settings.authentication.password
        };
      }

      case 'bearer': {
        if (!settings.authentication.token) return;

        return {
          type: 'bearer',
          token: settings.authentication.token
        };
      }

      case 'api-key': {
        // API Key auth is handled separately in handleApiKeyAuth()
        return undefined;
      }

      case 'none':
      default:
        return undefined;
    }
  }

  private async handleApiKeyAuth(options: ReqOptions, url: URL): Promise<void> {
    const settings = this.connector.settings;

    if (settings.authentication.type === 'api-key' && settings.authentication.apiKey && settings.authentication.apiValue) {
      const apiValue = await encryptionService.decryptText(settings.authentication.apiValue);

      if (settings.authentication.addTo === 'header') {
        if (!options.headers) options.headers = {};
        (options.headers as Record<string, string>)[settings.authentication.apiKey] = apiValue;
      } else {
        url.searchParams.append(settings.authentication.apiKey, apiValue);
      }
    }
  }

  /**
   * Convert an unknown request error to a readable message
   */
  private getMessageFromError(error: unknown) {
    if (!(error instanceof Error)) {
      return String(JSON.stringify(error));
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

      if ([message, code].filter(Boolean).length) {
        messages.push([message, code].filter(Boolean).join(', '));
      }
    }

    return messages.join('; ');
  }

  supportedTypes(): Array<string> {
    return ['any'];
  }
}
