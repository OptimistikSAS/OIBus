import path from 'node:path';
import { createReadStream } from 'node:fs';

import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { BaseFolders } from '../../model/types';
import { filesExists } from '../../service/utils';
import FormData from 'form-data';
import { URL } from 'node:url';
import { OIBusError } from '../../model/engine.model';
import { HTTPRequest, ReqAuthOptions, ReqProxyOptions, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthREST extends NorthConnector<NorthRESTSettings> {
  constructor(configuration: NorthConnectorEntity<NorthRESTSettings>, logger: pino.Logger, baseFolders: BaseFolders) {
    super(configuration, logger, baseFolders);
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
    filePath = path.resolve(filePath);

    if (!(await filesExists(filePath))) {
      throw new OIBusError(`File ${filePath} does not exist`, false);
    }

    const endpoint = new URL(this.connector.settings.endpoint, this.connector.settings.host);

    // Get query params
    const queryParams = this.getQueryParams();

    // Create FormData with file
    const { base } = path.parse(filePath);
    const form = new FormData();
    const fileStream = createReadStream(filePath);
    form.append('file', fileStream, { filename: base });

    let response: ReqResponse;
    try {
      response = await HTTPRequest(endpoint, {
        method: 'POST',
        headers: form.getHeaders(),
        query: queryParams,
        body: form,
        auth: this.getAuthorizationOptions(),
        proxy: this.getProxyOptions(),
        timeout: this.connector.settings.timeout * 1000
      });
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
    // the URL class handles the correct use of slashes
    const testEndpoint = new URL(this.connector.settings.testPath, this.connector.settings.host);
    let response: ReqResponse;
    try {
      response = await HTTPRequest(testEndpoint, {
        method: 'GET',
        auth: this.getAuthorizationOptions(),
        proxy: this.getProxyOptions(),
        timeout: this.connector.settings.timeout * 1000
      });
    } catch (error) {
      const message = this.getMessageFromError(error);
      throw new OIBusError(`Failed to reach file endpoint ${testEndpoint}; ${message}`, false);
    }

    if (!response.ok) {
      throw new OIBusError(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`, false);
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
   * Get proxy options if proxy is enabled
   * @throws Error if no proxy url is specified in settings
   */
  private getProxyOptions(): ReqProxyOptions | undefined {
    if (!this.connector.settings.useProxy) {
      return;
    }
    if (!this.connector.settings.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: this.connector.settings.proxyUrl
    };

    if (this.connector.settings.proxyUsername) {
      options.auth = {
        type: 'basic',
        username: this.connector.settings.proxyUsername,
        password: this.connector.settings.proxyPassword
      };
    }

    return options;
  }

  /**
   * Get authorization options from settings
   */
  private getAuthorizationOptions(): ReqAuthOptions | undefined {
    switch (this.connector.settings.authType) {
      case 'basic':
        if (!this.connector.settings.basicAuthUsername) return;

        return {
          type: 'basic',
          username: this.connector.settings.basicAuthUsername,
          password: this.connector.settings.basicAuthPassword
        };

      case 'bearer':
        if (!this.connector.settings.bearerAuthToken) return;

        return {
          type: 'bearer',
          token: this.connector.settings.bearerAuthToken
        };
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
