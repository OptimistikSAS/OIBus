import NorthConnector from '../north-connector';

import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { createReadStream } from 'node:fs';
import zlib from 'node:zlib';
import FormData from 'form-data';
import {
  HTTPRequest,
  ReqAuthOptions,
  ReqOptions,
  ReqProxyOptions,
  ReqResponse,
  retryableHttpStatusCodes
} from '../../service/http-request.utils';
import path from 'node:path';
import { compress, filesExists } from '../../service/utils';
import { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import fs from 'node:fs/promises';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import { OIBusError } from '../../model/engine.model';
import { BaseFolders } from '../../model/types';

/**
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector<NorthOIAnalyticsSettings> {
  constructor(
    connector: NorthConnectorEntity<NorthOIAnalyticsSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  override async testConnection(): Promise<void> {
    const host = this.getHost();
    const requestUrl = new URL('/api/optimistik/oibus/status', host);

    const fetchOptions: ReqOptions = {
      method: 'GET',
      auth: await this.getAuthorizationOptions(),
      proxy: this.getProxyOptions(),
      timeout: this.connector.settings.timeout * 1000
    };

    let response: ReqResponse;
    try {
      response = await HTTPRequest(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'raw':
        return this.handleFile(cacheMetadata.contentFile);

      case 'time-values':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusTimeValue>);
    }
  }

  /**
   * Handle values by sending them to OIAnalytics
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    const host = this.getHost();
    const endpoint = this.connector.settings.compress
      ? '/api/oianalytics/oibus/time-values/compressed'
      : '/api/oianalytics/oibus/time-values';

    let response: ReqResponse;
    const valuesUrl = new URL(endpoint, host);
    const fetchOptions: ReqOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      query: { dataSourceId: this.connector.name },
      body: this.connector.settings.compress ? zlib.gzipSync(JSON.stringify(values)) : JSON.stringify(values),
      auth: await this.getAuthorizationOptions(),
      proxy: this.getProxyOptions(),
      timeout: this.connector.settings.timeout * 1000
    };

    try {
      response = await HTTPRequest(valuesUrl, fetchOptions);
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
    const host = this.getHost();
    const endpoint = '/api/oianalytics/file-uploads';
    const query = { dataSourceId: this.connector.name };
    const fileUrl = new URL(endpoint, host);

    if (!(await filesExists(filePath))) {
      throw new Error(`File ${filePath} does not exist`);
    }

    const { name, ext, dir } = path.parse(filePath);
    const timestamp = name.slice(name.lastIndexOf('-'));

    let fileToSend = filePath;
    if (this.connector.settings.compress && !filePath.endsWith('.gz')) {
      // compress if enabled and file to send is not a compressed one
      fileToSend = `${name.slice(0, name.lastIndexOf('-'))}${ext}${timestamp}.gz`;
      if (!(await filesExists(path.resolve(dir, fileToSend)))) {
        // Compress only if the file has not been compressed by another try first
        await compress(filePath, path.resolve(dir, fileToSend));
      }
    }

    const readStream = createReadStream(path.resolve(dir, fileToSend));
    const body = new FormData();
    body.append('file', readStream, {
      filename: `${fileToSend.slice(0, fileToSend.lastIndexOf('-'))}${this.connector.settings.compress ? '.gz' : ext}`
    });

    let response: ReqResponse;
    try {
      response = await HTTPRequest(fileUrl, {
        method: 'POST',
        headers: body.getHeaders(),
        query,
        body,
        auth: await this.getAuthorizationOptions(),
        proxy: this.getProxyOptions(),
        timeout: this.connector.settings.timeout * 1000
      });
      if (!readStream.closed) {
        readStream.close();
      }
      if (this.connector.settings.compress && !filePath.endsWith('.gz')) {
        // Remove only the compressed file. The uncompressed file will be removed by north connector logic
        await fs.unlink(path.resolve(dir, fileToSend));
      }
    } catch (fetchError) {
      if (!readStream.closed) {
        readStream.close();
      }
      throw new OIBusError(`Fail to reach file endpoint ${fileUrl}. ${fetchError}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `Error ${response.statusCode}: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }
  }

  /**
   * Get proxy options if proxy is enabled
   * @throws Error if no proxy url is specified in settings
   */
  private getProxyOptions(): ReqProxyOptions | undefined {
    let settings: {
      useProxy: boolean;
      proxyUrl?: string | null;
      proxyUsername?: string | null;
      proxyPassword?: string | null;
    };
    let scope: string;

    // OIAnalytics module
    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }

      settings = registrationSettings;
      scope = 'registered OIAnalytics module';
    }
    // Specific settings
    else {
      settings = this.connector.settings.specificSettings!;
      scope = 'specific settings';
    }

    if (!settings.useProxy) {
      return;
    }
    if (!settings.proxyUrl) {
      throw new Error(`Proxy URL not specified using ${scope}`);
    }

    const options: ReqProxyOptions = {
      url: settings.proxyUrl
    };

    if (settings.proxyUsername) {
      options.auth = {
        type: 'url',
        username: settings.proxyUsername,
        password: settings.proxyPassword
      };
    }

    return options;
  }

  /**
   * Get authorization options from settings
   */
  private async getAuthorizationOptions(): Promise<ReqAuthOptions | undefined> {
    // OIAnalytics module
    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }

      return {
        type: 'bearer',
        token: registrationSettings.token!
      };
    }

    // Specific settings
    const specificSettings = this.connector.settings.specificSettings!;

    switch (specificSettings.authentication) {
      case 'basic': {
        if (!specificSettings.accessKey) return;

        return {
          type: 'basic',
          username: specificSettings.accessKey,
          password: specificSettings.secretKey
        };
      }

      case 'aad-client-secret': {
        const clientSecretCredential = new ClientSecretCredential(
          specificSettings.tenantId!,
          specificSettings.clientId!,
          await this.encryptionService.decryptText(specificSettings.clientSecret!)
        );
        const result = await clientSecretCredential.getToken(specificSettings.scope!);
        // Note: token needs to be encrypted when adding it to proxy options
        const token = await this.encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
        return {
          type: 'bearer',
          token
        };
      }

      case 'aad-certificate': {
        const certificate = this.certificateRepository.findById(specificSettings.certificateId!);
        if (certificate === null) return;

        const decryptedPrivateKey = await this.encryptionService.decryptText(certificate.privateKey);
        const clientCertificateCredential = new ClientCertificateCredential(specificSettings.tenantId!, specificSettings.clientId!, {
          certificate: `${certificate.certificate}\n${decryptedPrivateKey}`
        });
        const result = await clientCertificateCredential.getToken(specificSettings.scope!);
        // Note: token needs to be encrypted when adding it to proxy options
        const token = await this.encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
        return {
          type: 'bearer',
          token
        };
      }
    }
  }

  private getHost() {
    let host: string;

    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }
      host = registrationSettings.host;
    } else {
      const specificSettings = this.connector.settings.specificSettings!;
      host = specificSettings.host;
    }

    return host;
  }
}
