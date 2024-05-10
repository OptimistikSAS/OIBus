import NorthConnector from '../north-connector';

import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import EncryptionService from '../../service/encryption.service';
import { createProxyAgent } from '../../service/proxy-agent';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { createReadStream } from 'node:fs';
import zlib from 'node:zlib';
import FormData from 'form-data';
import path from 'node:path';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import { compress, filesExists } from '../../service/utils';
import { NorthOIAnalyticsSettings } from '../../../../shared/model/north-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import fs from 'node:fs/promises';

/**
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector<NorthOIAnalyticsSettings> {
  static type = manifest.id;

  constructor(
    connector: NorthConnectorDTO<NorthOIAnalyticsSettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, encryptionService, repositoryService, logger, baseFolder);
  }

  override async testConnection(): Promise<void> {
    const connectionSettings = await this.getNetworkSettings(`/api/optimistik/oibus/status`);
    const requestUrl = `${connectionSettings.host}/api/optimistik/oibus/status`;
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: connectionSettings.headers,
      timeout: this.connector.settings.timeout * 1000,
      agent: connectionSettings.agent
    };

    let response;
    try {
      response = await fetch(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
  }

  async handleContent(data: OIBusContent): Promise<void> {
    switch (data.type) {
      case 'raw':
        return this.handleFile(data.filePath);

      case 'time-values':
        return this.handleValues(data.content);
    }
  }

  /**
   * Handle values by sending them to OIAnalytics
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    const endpoint = this.connector.settings.compress
      ? `/api/oianalytics/oibus/time-values/compressed?dataSourceId=${encodeURI(this.connector.name)}`
      : `/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(this.connector.name)}`;
    const connectionSettings = await this.getNetworkSettings(endpoint);

    const badTypes = new Map<string, string>();
    // TODO: remove once south connectors payload are consistent
    const filteredValues = values.filter(oibusTimeValue => {
      if (typeof oibusTimeValue.data.value === 'string' || typeof oibusTimeValue.data.value === 'number') {
        return true;
      } else {
        badTypes.set(oibusTimeValue.pointId, oibusTimeValue.data.value);
        return false;
      }
    });

    if (badTypes.size > 0) {
      let warnMessage = 'Some references have an incompatible data type. These values are filtered.';
      for (const [reference, badType] of badTypes.entries()) {
        warnMessage += ` ${reference}: ${typeof badType} (${badType}) ;`;
      }
      this.logger.warn(warnMessage);
    }

    let response;
    const valuesUrl = `${connectionSettings.host}${endpoint}`;
    const fetchOptions = {
      method: 'POST',
      headers: {
        ...connectionSettings.headers,
        'Content-Type': 'application/json'
      },
      timeout: this.connector.settings.timeout * 1000,
      body: this.connector.settings.compress ? zlib.gzipSync(JSON.stringify(filteredValues)) : JSON.stringify(filteredValues),
      agent: connectionSettings.agent
    };
    try {
      response = await fetch(valuesUrl, fetchOptions);
    } catch (fetchError) {
      throw {
        message: `Fail to reach values endpoint ${valuesUrl}. ${fetchError}`,
        retry: true
      };
    }

    if (!response.ok) {
      throw {
        message: `Error ${response.status}: ${response.statusText}`,
        retry: [401, 403, 404, 500, 502, 503, 504].includes(response.status)
      };
    }
  }

  /**
   * Handle the file by sending it to OIAnalytics.
   */
  async handleFile(filePath: string): Promise<void> {
    const endpoint = `/api/oianalytics/file-uploads?dataSourceId=${encodeURI(this.connector.name)}`;
    const connectionSettings = await this.getNetworkSettings(endpoint);

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
    const formHeaders = body.getHeaders();
    Object.keys(formHeaders).forEach(key => {
      // @ts-ignore
      connectionSettings.headers[key] = formHeaders[key];
    });

    let response;
    const fileUrl = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(fileUrl, {
        method: 'POST',
        headers: connectionSettings.headers,
        timeout: this.connector.settings.timeout * 1000,
        body,
        agent: connectionSettings.agent
      });
      readStream.close();
      if (this.connector.settings.compress && !filePath.endsWith('.gz')) {
        // Remove only the compressed file. The uncompressed file will be removed by north connector logic
        await fs.unlink(path.resolve(dir, fileToSend));
      }
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
        retry: [400, 401, 403, 404, 500, 502, 503, 504].includes(response.status)
      };
    }
  }

  async getNetworkSettings(endpoint: string): Promise<{ host: string; headers: HeadersInit; agent: any }> {
    const headers: HeadersInit = {};

    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }

      if (registrationSettings.host.endsWith('/')) {
        registrationSettings.host = registrationSettings.host.slice(0, registrationSettings.host.length - 1);
      }

      const token = await this.encryptionService.decryptText(registrationSettings.token!);
      headers.authorization = `Bearer ${token}`;

      const agent = createProxyAgent(
        registrationSettings.useProxy,
        `${registrationSettings.host}${endpoint}`,
        registrationSettings.useProxy
          ? {
              url: registrationSettings.proxyUrl!,
              username: registrationSettings.proxyUsername!,
              password: registrationSettings.proxyPassword
                ? await this.encryptionService.decryptText(registrationSettings.proxyPassword)
                : null
            }
          : null,
        registrationSettings.acceptUnauthorized
      );

      return {
        host: registrationSettings.host,
        headers,
        agent
      };
    }

    const specificSettings = this.connector.settings.specificSettings!;
    if (specificSettings.host.endsWith('/')) {
      specificSettings.host = specificSettings.host.slice(0, specificSettings.host.length - 1);
    }

    switch (specificSettings.authentication) {
      case 'basic':
        headers.authorization = `Basic ${Buffer.from(
          `${specificSettings.accessKey}:${
            specificSettings.secretKey ? await this.encryptionService.decryptText(specificSettings.secretKey) : ''
          }`
        ).toString('base64')}`;
        break;
      case 'aad-client-secret':
        const clientSecretCredential = new ClientSecretCredential(
          specificSettings.tenantId!,
          specificSettings.clientId!,
          await this.encryptionService.decryptText(specificSettings.clientSecret!)
        );
        const result = await clientSecretCredential.getToken(specificSettings.scope!);
        headers.authorization = `Bearer ${Buffer.from(result.token)}`;
        break;
      case 'aad-certificate':
        const certificate = this.repositoryService.certificateRepository.findById(specificSettings.certificateId!);
        if (certificate != null) {
          const decryptedPrivateKey = await this.encryptionService.decryptText(certificate.privateKey);
          const clientCertificateCredential = new ClientCertificateCredential(specificSettings.tenantId!, specificSettings.clientId!, {
            certificate: `${certificate.certificate}\n${decryptedPrivateKey}`
          });
          const result = await clientCertificateCredential.getToken(specificSettings.scope!);
          headers.authorization = `Bearer ${Buffer.from(result.token)}`;
        }
        break;
    }

    const agent = createProxyAgent(
      specificSettings.useProxy,
      `${specificSettings.host}${endpoint}`,
      specificSettings.useProxy
        ? {
            url: specificSettings.proxyUrl!,
            username: specificSettings.proxyUsername!,
            password: specificSettings.proxyPassword ? await this.encryptionService.decryptText(specificSettings.proxyPassword) : null
          }
        : null,
      specificSettings.acceptUnauthorized
    );

    return {
      host: specificSettings.host,
      headers,
      agent
    };
  }
}
