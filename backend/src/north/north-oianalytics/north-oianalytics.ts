import NorthConnector from '../north-connector';
import { ReadStream } from 'node:fs';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { HTTPRequest, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';
import { streamToString } from '../../service/utils';
import { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CertificateRepository from '../../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import { OIBusError } from '../../model/engine.model';
import type { ICacheService } from '../../model/cache.service.model';
import { buildHttpOptions, getHost, getUrl, testOIAnalyticsConnection } from '../../service/utils-oianalytics';
import type { ILogger } from '../../model/logger.model';

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
    logger: ILogger,
    cacheService: ICacheService,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
  ) {
    super(connector, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'oianalytics'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    await testOIAnalyticsConnection(
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository,
      false
    );
    return { items: [] };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'any':
        return this.handleFile(fileStream, cacheMetadata);

      case 'time-values':
      case 'oianalytics':
        return this.handleValues(fileStream);
    }
  }

  async handleValues(fileStream: ReadStream): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'POST',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository
    );
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    const endpoint = this.connector.settings.compress
      ? '/api/oianalytics/oibus/time-values/compressed'
      : '/api/oianalytics/oibus/time-values';
    const url = getUrl(
      endpoint,
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    httpOptions.body = this.connector.settings.compress
      ? await streamToString(fileStream.pipe(zlib.createGzip({ level: 9 })))
      : await streamToString(fileStream);
    httpOptions.query = { dataSourceId: this.connector.name };

    let response: ReqResponse;
    try {
      response = await HTTPRequest(url, httpOptions);
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach values endpoint ${url}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }

  async handleFile(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const compress = this.connector.settings.compress && !cacheMetadata.contentFile.endsWith('.gz');
    const readStream = compress ? fileStream.pipe(zlib.createGzip({ level: 9 })) : fileStream;
    const filename = compress ? `${cacheMetadata.contentFile}.gz` : cacheMetadata.contentFile;

    const boundary = `OIBusBoundary${Date.now()}`;

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'POST',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository
    );
    const url = getUrl(
      '/api/oianalytics/file-uploads',
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    httpOptions.body = Readable.from(multipartStream(boundary, filename, readStream));
    httpOptions.query = { dataSourceId: this.connector.name };
    httpOptions.headers = { ...httpOptions.headers, 'content-type': `multipart/form-data; boundary=${boundary}` };
    let response: ReqResponse;
    try {
      response = await HTTPRequest(url, httpOptions);
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach file endpoint ${url}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }
}
