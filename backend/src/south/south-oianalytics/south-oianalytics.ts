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
import { createProxyAgent } from '../../service/proxy.service';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

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
    items: Array<SouthConnectorItemDTO<SouthOIAnalyticsItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusDataValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
    if (this.connector.settings.host.endsWith('/')) {
      this.connector.settings.host = this.connector.settings.host.slice(0, this.connector.settings.host.length - 1);
    }
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.host}"`);

    const headers: HeadersInit = {};
    const basic = Buffer.from(
      `${this.connector.settings.accessKey}:${await this.encryptionService.decryptText(this.connector.settings.secretKey!)}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;
    const requestUrl = `${this.connector.settings.host}/api/optimistik/oibus/status`;
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      agent: createProxyAgent(
        this.connector.settings.useProxy,
        requestUrl,
        this.connector.settings.useProxy
          ? {
              url: this.connector.settings.proxyUrl!,
              username: this.connector.settings.proxyUsername!,
              password: this.connector.settings.proxyPassword
                ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
                : null
            }
          : null,
        this.connector.settings.acceptUnauthorized
      )
    };

    try {
      const response = await fetch(requestUrl, fetchOptions);
      if (response.ok) {
        this.logger.info('OIAnalytics request successful');
        return;
      }
      this.logger.error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    } catch (error) {
      this.logger.error(`Fetch error ${error}`);
      throw new Error(`Fetch error ${error}`);
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
    const headers: HeadersInit = {};
    const basic = Buffer.from(
      `${this.connector.settings.accessKey}:${await this.encryptionService.decryptText(this.connector.settings.secretKey!)}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;

    const requestUrl = `${this.connector.settings.host}${item.settings.endpoint}${formatQueryParams(
      startTime,
      endTime,
      item.settings.queryParams || []
    )}`;
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      agent: createProxyAgent(
        this.connector.settings.useProxy,
        requestUrl,
        this.connector.settings.useProxy
          ? {
              url: this.connector.settings.proxyUrl!,
              username: this.connector.settings.proxyUsername!,
              password: this.connector.settings.proxyPassword
                ? await this.encryptionService.decryptText(this.connector.settings.proxyPassword)
                : null
            }
          : null,
        this.connector.settings.acceptUnauthorized
      )
    };

    this.logger.info(`Requesting data from URL "${requestUrl}"`);

    const response = await fetch(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
    return response.json();
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
  parseData(httpResult: Array<OIATimeValues>): { formattedResult: Array<OIBusDataValue>; maxInstant: Instant } {
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