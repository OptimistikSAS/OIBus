import path from 'node:path';

import fetch, { HeadersInit, RequestInit } from 'node-fetch';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { createFolder, formatQueryParams, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../../shared/model/south-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import { ClientSecretCredential, ClientCertificateCredential } from '@azure/identity';

interface OIATimeValues {
  type: string;
  data?: {
    id: string;
    dataType: string;
    reference: string;
    description: string;
  };
  unit?: {
    id: string;
    label: string;
  };
  values: Array<number>;
  timestamps: Array<Instant>;
}

/**
 * Class SouthOIAnalytics - Retrieve data from OIAnalytics REST API
 */
export default class SouthOIAnalytics
  extends SouthConnector<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>
  implements QueriesHistory
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthOIAnalyticsSettings>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusTimeValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const connectionSettings = await this.getNetworkSettings('/api/optimistik/oibus/status');
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

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemDTO<SouthOIAnalyticsItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<any> = await this.queryData(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      const { formattedResult, maxInstant } = this.parseData(result);

      if (maxInstant > updatedStartTime) {
        updatedStartTime = maxInstant;
      }
      if (formattedResult.length > 0) {
        this.logger.info(`Found ${formattedResult.length} results for item ${item.name} in ${requestDuration} ms`);

        await persistResults(
          formattedResult,
          item.settings.serialization,
          this.connector.name,
          item.name,
          this.tmpFolder,
          this.addFile.bind(this),
          this.addValues.bind(this),
          this.logger
        );
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  async queryData(item: SouthConnectorItemDTO<SouthOIAnalyticsItemSettings>, startTime: Instant, endTime: Instant): Promise<any> {
    const connectionSettings = await this.getNetworkSettings(
      `${item.settings.endpoint}${formatQueryParams(startTime, endTime, item.settings.queryParams || [])}`
    );

    const requestUrl = `${connectionSettings.host}${item.settings.endpoint}${formatQueryParams(
      startTime,
      endTime,
      item.settings.queryParams || []
    )}`;
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: connectionSettings.headers,
      timeout: this.connector.settings.timeout * 1000,
      agent: connectionSettings.agent
    };

    this.logger.info(`Requesting data from URL "${requestUrl}"`);

    const response = await fetch(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
    return response.json();
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

  /**
   * Parse data from OIAnalytics time values API
   * check data from OIAnalytics API for result of
   * For now, only 'time-values' type is accepted
   * Expected data are : [
   *   {
   *     type: 'time-values',
   *     unit: { id: '2', label: '%' },
   *     data: {
   *       dataType: 'RAW_TIME_DATA',
   *       id: 'D4',
   *       reference: 'DCS_CONC_O2_MCT',
   *       description: 'Concentration O2 fermentation'
   *     },
   *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
   *     values: [63.6414804414747,  87.2277880675425]
   *   },
   *   {
   *     type: 'time-values',
   *     unit: { id: '180', label: 'pH' },
   *     data: {
   *       dataType: 'RAW_TIME_DATA',
   *       id: 'D5',
   *       reference: 'DCS_PH_MCT',
   *       description: 'pH fermentation'
   *     },
   *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
   *     values: [7.51604342731906,  7.5292481205665]
   *   }
   * ]
   * Return the formatted results flattened for easier access
   * (into csv files for example) and the latestDateRetrieved in ISO String format
   */
  parseData(httpResult: Array<OIATimeValues>): { formattedResult: Array<OIBusTimeValue>; maxInstant: Instant } {
    if (!Array.isArray(httpResult)) {
      throw Error('Bad data: expect OIAnalytics time values to be an array');
    }
    const formattedData: Array<any> = [];
    let maxInstant = DateTime.fromMillis(0).toUTC().toISO()!;
    for (const element of httpResult) {
      if (!element.data?.reference) {
        throw Error('Bad data: expect data.reference field');
      }
      if (!element.unit?.label) {
        throw Error('Bad data: expect unit.label field');
      }
      if (!Array.isArray(element.values)) {
        throw Error('Bad data: expect values to be an array');
      }
      if (!Array.isArray(element.timestamps)) {
        throw Error('Bad data: expect timestamps to be an array');
      }

      element.values.forEach((currentValue: any, index: number) => {
        const resultInstant = DateTime.fromISO(element.timestamps[index]).toUTC().toISO()!;

        formattedData.push({
          pointId: element.data!.reference,
          timestamp: resultInstant,
          data: { value: currentValue, unit: element.unit!.label }
        });
        if (resultInstant > maxInstant) {
          maxInstant = resultInstant;
        }
      });
    }
    return { formattedResult: formattedData, maxInstant };
  }
}
