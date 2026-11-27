import { ReadStream } from 'node:fs';
import { pipeline, Readable } from 'node:stream';
import zlib from 'node:zlib';

import { NorthOIAnalyticsSettings } from '../../../shared/model/connector/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { ServerIdentity, ServerIdentityTrustStatus } from '../../../shared/model/domain/server-identity.model';

import { OIBusError } from '../../model/engine.model';
import type { ILogger } from '../../model/logger.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type CacheService from '../../service/cache/cache.service';
import type CertificateService from '../../service/certificate.service';
import { HTTPRequest, ReqOptions, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';
import { toServerNotTrustedError } from '../../service/server-trust.utils';
import { getErrorMessage } from '../../service/utils';
import {
  buildHttpOptions,
  getHost,
  getOIAnalyticsProbeTarget,
  getOIAnalyticsTlsSettings,
  getUrl,
  testOIAnalyticsConnection,
  toRegistrationNotTrustedError
} from '../../service/utils-oianalytics';
import { TlsServerTrust } from '../../service/utils-tls';
import NorthConnector from '../north-connector';

/**
 * Pipe `source` into a freshly created gzip Transform and return it, wired through
 * `pipeline()` (not a raw `.pipe()`) so that if either stream errors or is destroyed by
 * whatever consumes the returned Transform (e.g. undici aborting the request), the other
 * one is torn down too — a raw `.pipe()` here leaves the gzip stream (and its native zlib
 * buffer) dangling whenever the failure originates on the other side of the pipe.
 */
function gzipStream(source: Readable, logger: ILogger, level?: number): zlib.Gzip {
  const gzip = zlib.createGzip(level === undefined ? undefined : { level });
  pipeline(source, gzip, error => {
    if (error) {
      logger.error(`Error while compressing stream: ${getErrorMessage(error)}`);
    }
  });
  return gzip;
}

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
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector<NorthOIAnalyticsSettings> {
  constructor(
    connector: NorthConnectorEntity<NorthOIAnalyticsSettings>,
    cacheService: CacheService,
    private readonly certificateService: CertificateService,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
  ) {
    super(connector, cacheService);
  }

  /**
   * The validation of the certificate of OIAnalytics (see `TlsServerTrust`): as the registration of OIBus validates it when
   * the connector uses it (the identity of OIAnalytics is then reviewed from the registration), or as its specific settings do
   */
  private readonly tlsServerTrust = new TlsServerTrust(
    () =>
      getOIAnalyticsTlsSettings(
        this.connector.settings.useOiaModule,
        this.oIAnalyticsRegistrationRepository.get()!,
        this.connector.settings.specificSettings
      ),
    () => (this.connector.settings.useOiaModule ? null : this.connector.serverTrust.identity),
    certificateId => this.certificateService.findById(certificateId),
    () =>
      this.connector.settings.useOiaModule
        ? null
        : getOIAnalyticsProbeTarget(
            false,
            this.oIAnalyticsRegistrationRepository.get()!,
            this.connector.settings.specificSettings,
            this.connector.settings.timeout * 1000
          ),
    (presented, status) => this.serverIdentityVerifier.refuseCertificate(presented, status)
  );

  override async retrieveServerIdentity(): Promise<ServerIdentity | null> {
    return await this.tlsServerTrust.retrieveServerIdentity();
  }

  /** Whether the certificate OIAnalytics presents validates (see `testConnectionWithServerIdentity`) */
  getServerIdentityTrustStatus(presented: ServerIdentity): ServerIdentityTrustStatus {
    return this.tlsServerTrust.status(presented);
  }

  /**
   * Sends a request to OIAnalytics, validating its certificate: when it does not validate, the certificate OIAnalytics
   * presents is kept as pending, for a user to review and trust it (from the registration, when the connector uses it)
   */
  private async request(url: URL, options: ReqOptions): Promise<ReqResponse> {
    try {
      return await HTTPRequest(url, { ...options, tls: this.tlsServerTrust.tls() });
    } catch (error: unknown) {
      if (this.connector.settings.useOiaModule) {
        throw toRegistrationNotTrustedError(error);
      }
      if (await this.tlsServerTrust.refuseIfNotTrusted(error)) {
        throw toServerNotTrustedError(this, error);
      }
      throw error;
    }
  }

  supportedTypes(): Array<string> {
    return ['file', 'oianalytics'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    await testOIAnalyticsConnection(
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      (url, options) => this.request(url, options),
      false
    );
    return { items: [] };
  }

  handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'file':
        return this.handleFile(fileStream, cacheMetadata);

      case 'oianalytics':
        return this.handleValues(fileStream, cacheMetadata);

      default:
        return Promise.resolve();
    }
  }

  /**
   * Send time values to OIAnalytics: the `oianalytics` content is in the compact format `{ timestamps, values, references }`
   * of its `/time-values/compact` endpoints, and is streamed as is.
   */
  async handleValues(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'POST',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateService
    );
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    const endpoint = this.connector.settings.compress
      ? '/api/oianalytics/oibus/time-values/compact/compressed'
      : '/api/oianalytics/oibus/time-values/compact';
    const url = getUrl(
      endpoint,
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    addDataSourceParams(url, cacheMetadata);
    // Stream the body directly (or through async gzip) instead of gzipping synchronously on the event loop.
    httpOptions.body = this.connector.settings.compress ? gzipStream(fileStream, this.logger) : fileStream;

    let response: ReqResponse;
    try {
      response = await this.request(url, httpOptions);
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach values endpoint ${url}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async handleFile(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const compress = this.connector.settings.compress && !cacheMetadata.contentFile.endsWith('.gz');
    const readStream = compress ? gzipStream(fileStream, this.logger, 9) : fileStream;
    const filename = compress ? `${cacheMetadata.contentFile}.gz` : cacheMetadata.contentFile;

    const boundary = `OIBusBoundary${Date.now()}`;

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'POST',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateService
    );
    const url = getUrl(
      '/api/oianalytics/oibus/file',
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    addDataSourceParams(url, cacheMetadata);
    httpOptions.body = Readable.from(multipartStream(boundary, filename, readStream));
    httpOptions.headers = { ...httpOptions.headers, 'content-type': `multipart/form-data; boundary=${boundary}` };
    let response: ReqResponse;
    try {
      response = await this.request(url, httpOptions);
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach file endpoint ${url}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
    await response.body.dump();
  }
}

/**
 * Tell OIAnalytics which data source (south connector) the content comes from, so it can track the last communication
 * of each south connector. Content is never merged across data sources (see `CacheService.compactQueue`).
 */
const addDataSourceParams = (url: URL, cacheMetadata: CacheMetadata): void => {
  if (cacheMetadata.dataSource) {
    url.searchParams.set('dataSourceId', cacheMetadata.dataSource.id);
    url.searchParams.set('dataSourceName', cacheMetadata.dataSource.name);
  }
};
