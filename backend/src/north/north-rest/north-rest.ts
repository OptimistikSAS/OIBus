import { ReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { URL } from 'node:url';

import { UndiciHeaders } from 'undici/types/dispatcher';

import { NorthRESTSettings } from '../../../shared/model/connector/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { ServerIdentity, ServerIdentityTrustStatus } from '../../../shared/model/domain/server-identity.model';

import { OIBusError } from '../../model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type CacheService from '../../service/cache/cache.service';
import type CertificateService from '../../service/certificate.service';
import { encryptionService } from '../../service/encryption.service';
import {
  HTTPRequest,
  ReqAuthOptions,
  ReqOptions,
  ReqProxyOptions,
  ReqResponse,
  retryableHttpStatusCodes
} from '../../service/http-request.utils';
import { toServerNotTrustedError } from '../../service/server-trust.utils';
import { TlsServerTrust } from '../../service/utils-tls';
import NorthConnector from '../north-connector';

async function* multipartStream(boundary: string, filename: string, dataStream: AsyncIterable<Buffer>) {
  yield Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  );
  for await (const chunk of dataStream) {
    yield chunk;
  }
  yield Buffer.from(`\r\n--${boundary}--\r\n`);
}

/**
 * Class Console - display values and file path into the console
 */
export default class NorthREST extends NorthConnector<NorthRESTSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthRESTSettings>,
    cacheService: CacheService,
    private readonly certificateService: CertificateService
  ) {
    super(configuration, cacheService);
  }

  /** The validation of the certificate of the server (see `TlsServerTrust`) */
  private readonly tlsServerTrust = new TlsServerTrust(
    () => this.connector.settings,
    () => this.connector.serverTrust.identity,
    certificateId => this.certificateService.findById(certificateId),
    () => {
      const { host, proxy, timeout } = this.connector.settings;
      if (!/^https:\/\//i.test(host)) {
        return null;
      }
      return {
        url: host,
        defaultPort: 443,
        proxy:
          proxy.useProxy && proxy.proxyUrl
            ? {
                url: proxy.proxyUrl,
                username: proxy.proxyUsername,
                password: proxy.proxyPassword ? encryptionService.decryptText(proxy.proxyPassword) : null
              }
            : null,
        timeoutMs: timeout * 1000
      };
    },
    (presented, status) => this.serverIdentityVerifier.refuse(presented, status)
  );

  override async retrieveServerIdentity(): Promise<ServerIdentity | null> {
    return await this.tlsServerTrust.retrieveServerIdentity();
  }

  /** Whether the certificate the server presents validates (see `testConnectionWithServerIdentity`) */
  getServerIdentityTrustStatus(presented: ServerIdentity): ServerIdentityTrustStatus {
    return this.tlsServerTrust.status(presented);
  }

  /**
   * Sends a request to the server, validating its certificate: when it does not validate, the certificate the server
   * presents is kept as pending, for a user to review and trust it
   */
  private async request(url: string | URL, options: ReqOptions): Promise<ReqResponse> {
    try {
      return await HTTPRequest(url, { ...options, tls: this.tlsServerTrust.tls() });
    } catch (error: unknown) {
      if (await this.tlsServerTrust.refuseIfNotTrusted(error)) {
        throw toServerNotTrustedError(this, error);
      }
      throw error;
    }
  }

  supportedTypes(): Array<string> {
    return ['file'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const testEndpoint = this.connector.settings.test.testEndpoint;
    const testMethod = this.connector.settings.test.testMethod;
    const successCode = this.connector.settings.test.testSuccessCode;

    const requestUrl = new URL(testEndpoint, this.connector.settings.host);

    let response: ReqResponse;
    try {
      const proxy = this.getProxyOptions();
      const fetchOptions: ReqOptions = {
        method: testMethod,
        auth: this.getAuthorizationOptions(),
        proxy,
        timeout: this.connector.settings.timeout * 1000,
        body: this.connector.settings.test.body && ['POST', 'PUT'].includes(testMethod) ? this.connector.settings.test.body : undefined
      };

      this.handleApiKeyAuth(fetchOptions, requestUrl);

      response = await this.request(requestUrl, fetchOptions);
    } catch (error: unknown) {
      throw new Error(`Fetch error: ${(error as Error).message}`);
    }

    if (response.statusCode !== successCode) {
      throw new Error(
        `HTTP request failed with status code ${response.statusCode}, expected ${successCode}. Message: ${await response.body.text()}`
      );
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
    return {
      items: [
        { key: 'URL', value: requestUrl.toString() },
        { key: 'Status Code', value: String(response.statusCode) }
      ]
    };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const requestUrl = new URL(this.connector.settings.endpoint, this.connector.settings.host);

    const query: Record<string, string | number> = {};
    for (const queryParam of this.connector.settings.queryParams) {
      query[queryParam.key] = queryParam.value;
    }

    const headers: UndiciHeaders = {};
    let body: Readable | ReadStream;

    if (this.connector.settings.sendAs === 'file') {
      const boundary = `OIBusBoundary${Date.now()}`;
      headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
      body = Readable.from(multipartStream(boundary, cacheMetadata.contentFile, fileStream));
    } else {
      // Send raw body
      body = fileStream;
      const ext = path.extname(cacheMetadata.contentFile).toLowerCase();
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

    // Append Custom Headers
    for (const header of this.connector.settings.headers) {
      headers[header.key] = header.value;
    }

    const proxy = this.getProxyOptions();

    const fetchOptions: ReqOptions = {
      method: this.connector.settings.method,
      query,
      body,
      headers: headers,
      auth: this.getAuthorizationOptions(),
      proxy,
      timeout: this.connector.settings.timeout * 1000
    };

    this.handleApiKeyAuth(fetchOptions, requestUrl);

    let response: ReqResponse;
    try {
      response = await this.request(requestUrl, fetchOptions);
    } catch (error) {
      const message = this.getMessageFromError(error);
      throw new OIBusError(`Failed to reach file endpoint "${requestUrl.toString()}": ${message}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  private getProxyOptions(): ReqProxyOptions | undefined {
    const settings = this.connector.settings;

    if (!settings.proxy.useProxy) {
      return undefined;
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

    return options;
  }

  private getAuthorizationOptions(): ReqAuthOptions | undefined {
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

  private handleApiKeyAuth(options: ReqOptions, url: URL): void {
    const settings = this.connector.settings;

    if (settings.authentication.type === 'api-key' && settings.authentication.apiKey && settings.authentication.apiValue) {
      const apiValue = encryptionService.decryptText(settings.authentication.apiValue);

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
    if (error instanceof AggregateError) {
      const errors: Array<Error> = [error];

      errors.push(...error.errors);

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

    if (error instanceof Error) {
      return error.message;
    }

    return error;
  }
}
