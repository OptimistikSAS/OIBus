import path from 'node:path';

import fetch from 'node-fetch';
import https from 'https';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { createFolder, formatQueryParams, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../../shared/model/south-settings.model';

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
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthOIAnalyticsSettings>,
    items: Array<SouthConnectorItemDTO<SouthOIAnalyticsItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  // TODO: method needs to be implemented
  override async testConnection(): Promise<void> {
    this.logger.trace(`Testing connection`);
    throw new Error('TODO: method needs to be implemented');
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

      const { formattedResult, maxInstant } = this.parseData(item, result);

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
    const headers: Record<string, string> = {};
    const basic = Buffer.from(
      `${this.connector.settings.authentication.username}:${await this.encryptionService.decryptText(
        this.connector.settings.authentication.password!
      )}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;

    const fetchOptions: Record<string, any> = {
      method: 'GET',
      headers,
      agent: this.connector.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
      timeout: item.settings.requestTimeout
    };
    const requestUrl = `${this.connector.settings.url}:${this.connector.settings.port}${item.settings.endpoint}${formatQueryParams(
      startTime,
      endTime,
      item.settings.queryParams || []
    )}`;

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
  parseData(item: SouthConnectorItemDTO<any>, httpResult: Array<OIATimeValues>): { formattedResult: Array<any>; maxInstant: Instant } {
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
          unit: element.unit!.label,
          timestamp: resultInstant,
          value: currentValue
        });
        if (resultInstant > maxInstant) {
          maxInstant = resultInstant;
        }
      });
    }
    return { formattedResult: formattedData, maxInstant };
  }
}
