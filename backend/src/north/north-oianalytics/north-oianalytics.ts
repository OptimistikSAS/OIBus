import NorthConnector from '../north-connector';
import pino from 'pino';
import { createReadStream } from 'node:fs';
import zlib from 'node:zlib';
import FormData from 'form-data';
import { HTTPRequest, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';
import path from 'node:path';
import { compress, filesExists } from '../../service/utils';
import { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import fs from 'node:fs/promises';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CertificateRepository from '../../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import { OIBusError } from '../../model/engine.model';
import CacheService from '../../service/cache/cache.service';
import { buildHttpOptions, getHost } from '../../service/utils-oianalytics';

/**
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector<NorthOIAnalyticsSettings> {
  constructor(
    connector: NorthConnectorEntity<NorthOIAnalyticsSettings>,
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
  ) {
    super(connector, logger, cacheFolderPath, cacheService);
  }

  override async testConnection(): Promise<void> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'GET',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository
    );
    const host = getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings);
    const requestUrl = new URL('/api/optimistik/oibus/status', host);

    let response: ReqResponse;
    try {
      response = await HTTPRequest(requestUrl, httpOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }

    switch (cacheMetadata.contentType) {
      case 'any':
        return this.handleFile(cacheMetadata.contentFile);

      case 'time-values':
      case 'oianalytics':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusTimeValue>);
    }
  }

  /**
   * Handle values by sending them to OIAnalytics
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
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
    const host = getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings);
    const endpoint = this.connector.settings.compress
      ? '/api/oianalytics/oibus/time-values/compressed'
      : '/api/oianalytics/oibus/time-values';
    const valuesUrl = new URL(endpoint, host);
    httpOptions.body = this.connector.settings.compress ? zlib.gzipSync(JSON.stringify(values)) : JSON.stringify(values);
    httpOptions.query = { dataSourceId: this.connector.name };

    let response: ReqResponse;
    try {
      response = await HTTPRequest(valuesUrl, httpOptions);
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach values endpoint ${valuesUrl}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }

  /**
   * Handle the file by sending it to OIAnalytics.
   */
  async handleFile(filePath: string): Promise<void> {
    if (!(await filesExists(filePath))) {
      throw new Error(`File ${filePath} does not exist`);
    }
    const { name, ext, dir } = path.parse(filePath);
    const randomString = name.slice(name.lastIndexOf('-'));

    const fileToSend =
      this.connector.settings.compress && ext !== '.gz'
        ? path.resolve(dir, `${name.replace(randomString, '')}${ext}${randomString}.gz`)
        : path.resolve(dir, `${name}${ext}`);
    if (this.connector.settings.compress && ext !== '.gz' && !(await filesExists(fileToSend))) {
      // Compress only if the file has not been compressed by another try first
      await compress(filePath, fileToSend);
    }

    const readStream = createReadStream(fileToSend);
    const body = new FormData();
    const filename = path.parse(fileToSend).base.replace(randomString, '');
    body.append('file', readStream, {
      filename
    });

    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'POST',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository
    );
    const host = getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings);
    const endpoint = '/api/oianalytics/file-uploads';
    const fileUrl = new URL(endpoint, host);
    httpOptions.body = body;
    httpOptions.query = { dataSourceId: this.connector.name };
    httpOptions.headers = { ...httpOptions.headers, ...body.getHeaders() };
    let response: ReqResponse;
    try {
      response = await HTTPRequest(fileUrl, httpOptions);
      readStream.close();
      if (this.connector.settings.compress && ext !== '.gz') {
        // Remove only the compressed file. The uncompressed file will be removed by north connector logic
        await fs.unlink(fileToSend);
      }
    } catch (fetchError) {
      throw new OIBusError(`Fail to reach file endpoint ${fileUrl}. ${fetchError}`, true);
    } finally {
      if (!readStream.closed) {
        readStream.close();
      }
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'oianalytics'];
  }
}
