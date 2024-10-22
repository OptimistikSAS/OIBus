import path from 'node:path';

import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  formatQueryParams,
  generateCsvContent,
  generateFilenameForSerialization,
  httpGetWithBody,
  persistResults
} from '../../service/utils';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthSlimsItemSettings, SouthSlimsSettings } from '../../../../shared/model/south-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusContent } from '../../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

export interface SlimsColumn {
  name: string;
  value: unknown;
  unit?: string;
}

export interface SlimsEntity {
  columns: Array<SlimsColumn>;
}

export interface SlimsResults {
  entities: Array<SlimsEntity>;
}

interface SlimsDataValue {
  pointId: string;
  timestamp: Instant;
  value: string | number;
  unit: string;
}

/**
 * Class SouthSlims - Retrieve data from SLIMS REST API
 */
export default class SouthSlims extends SouthConnector<SouthSlimsSettings, SouthSlimsItemSettings> implements QueriesHistory {
  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolder
    );
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
    if (this.connector.settings.url.endsWith('/')) {
      this.connector.settings.url = this.connector.settings.url.slice(0, this.connector.settings.url.length - 1);
    }
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const headers: HeadersInit = {};
    const basic = Buffer.from(
      `${this.connector.settings.username}:${await this.encryptionService.decryptText(this.connector.settings.password!)}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;
    const requestUrl = `${this.connector.settings.url}:${this.connector.settings.port}/slimsrest/rest`;

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      timeout: this.connector.settings.timeout * 1000,
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

    let response;
    try {
      response = await fetch(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    switch (response.status) {
      case 404: // 404 is included because /slimsrest/rest is not found but the authentication occurs before. There is no ping to test the connection
      case 200:
      case 201:
        return;
      default:
        throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
  }

  override async testItem(item: SouthConnectorItemEntity<SouthSlimsItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
    const startTime = DateTime.now()
      .minus(600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;
    const result: SlimsResults = await this.queryData(item, startTime, endTime);
    const { formattedResult } = this.parseData(item, result);

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        const content = generateCsvContent(
          formattedResult as unknown as Array<Record<string, string | number>>,
          item.settings.serialization.delimiter
        );
        oibusContent = { type: 'raw', filePath, content };
        break;
      }
    }
    callback(oibusContent);
  }

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthSlimsItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: SlimsResults = await this.queryData(item, updatedStartTime, endTime);
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
          item.name,
          this.tmpFolder,
          this.addContent.bind(this),
          this.logger
        );
      } else {
        this.logger.info(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  async queryData(item: SouthConnectorItemEntity<SouthSlimsItemSettings>, startTime: Instant, endTime: Instant): Promise<SlimsResults> {
    const headers: HeadersInit = {};
    const basic = Buffer.from(
      `${this.connector.settings.username}:${await this.encryptionService.decryptText(this.connector.settings.password!)}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference) || null;
    const slimsStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const slimsEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);

    // SLIMS uses a body with GET. It's not standard and requires a specific implementation
    if (item.settings.body) {
      const bodyToSend = item.settings.body.replace(/@StartTime/g, `${slimsStartTime}`).replace(/@EndTime/g, `${slimsEndTime}`);
      headers['content-type'] = 'application/json';
      headers['content-length'] = `${bodyToSend.length}`;
      let host = this.connector.settings.url;
      let protocol = 'http:';
      if (this.connector.settings.url.startsWith('http://')) {
        host = this.connector.settings.url.substring(7);
      } else if (this.connector.settings.url.startsWith('https://')) {
        host = this.connector.settings.url.substring(8);
        protocol = 'https:';
      }
      const requestOptions: Record<string, string | number | unknown> = {
        method: 'GET',
        agent: createProxyAgent(
          this.connector.settings.useProxy,
          this.connector.settings.url,
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
        ),
        host,
        protocol,
        port: this.connector.settings.port,
        path: item.settings.endpoint,
        timeout: this.connector.settings.timeout * 1000,
        headers
      };

      this.logger.info(
        `Requesting data with GET method and body "${bodyToSend}" on: "${requestOptions.host}:${requestOptions.port}${requestOptions.path}"`
      );

      return (await httpGetWithBody(bodyToSend, requestOptions)) as SlimsResults;
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      timeout: this.connector.settings.timeout * 1000,
      agent: createProxyAgent(
        this.connector.settings.useProxy,
        this.connector.settings.url,
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
    const requestUrl = `${this.connector.settings.url}:${this.connector.settings.port}${item.settings.endpoint}${formatQueryParams(
      slimsStartTime,
      slimsEndTime,
      item.settings.queryParams || []
    )}`;

    this.logger.info(`Requesting data from URL "${requestUrl}"`);

    const response = await fetch(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
    return (await response.json()) as SlimsResults;
  }

  /**
   * Parse data from SLIMS Result table
   * Return the formatted results flattened for easier access
   * (into csv files for example) and the latestDateRetrieved in ISO String format
   */
  parseData(
    item: SouthConnectorItemEntity<SouthSlimsItemSettings>,
    httpResult: SlimsResults
  ): {
    formattedResult: Array<SlimsDataValue>;
    maxInstant: Instant;
  } {
    if (!httpResult?.entities || !Array.isArray(httpResult.entities)) {
      throw new Error('Bad data: expect SLIMS values to be an array.');
    }
    const formattedData: Array<SlimsDataValue> = [];
    let maxInstant = DateTime.fromMillis(0).toUTC().toISO()!;
    for (const element of httpResult.entities) {
      const rsltCfPid = element.columns.find(column => column.name === 'rslt_cf_pid');
      if (!rsltCfPid?.value) {
        throw new Error('Bad data: expect rslt_cf_pid to have a value');
      }
      const testName = element.columns.find(column => column.name === 'test_name');
      if (!testName?.value) {
        throw Error('Bad data: expect test_name to have a value');
      }
      const rsltValue = element.columns.find(column => column.name === 'rslt_value');
      if (!rsltValue || (rsltValue && rsltValue.value === null)) {
        throw new Error('Bad data: expect rslt_value to have a unit and a value');
      }
      const rsltModifiedOn = element.columns.find(column => column.name === 'rslt_modifiedOn');
      if (!rsltModifiedOn?.value) {
        throw new Error('Bad data: expect rslt_modifiedOn to have a value');
      }

      const rsltCfSamplingDateAndTime = element.columns.find(column => column.name === 'rslt_cf_samplingDateAndTime');
      if (!rsltCfSamplingDateAndTime?.value) {
        throw new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value');
      }

      const samplingDatetimeField = item.settings.dateTimeFields?.find(
        dateTimeField => dateTimeField.fieldName === 'rslt_cf_samplingDateAndTime'
      );
      if (!samplingDatetimeField) {
        throw new Error('Bad config: expect rslt_cf_samplingDateAndTime to have an associated date time fields (see item)');
      }
      const resultInstant = convertDateTimeToInstant(rsltCfSamplingDateAndTime.value as string, samplingDatetimeField);
      const referenceDatetimeField = item.settings.dateTimeFields!.find(
        dateTimeField => dateTimeField.fieldName === 'rslt_modifiedOn' && dateTimeField.useAsReference
      );
      if (!referenceDatetimeField) {
        throw new Error('Bad config: expect to have a reference field (rslt_modifiedOn) in date time fields (see item)');
      }
      const referenceInstant = convertDateTimeToInstant(rsltModifiedOn.value as string, referenceDatetimeField);

      formattedData.push({
        pointId: `${rsltCfPid.value}-${testName.value}`,
        timestamp: formatInstant(resultInstant, { type: 'iso-string' }) as Instant,
        value: rsltValue.value as string,
        unit: rsltValue.unit || 'Ø'
      });
      if (referenceInstant > maxInstant) {
        maxInstant = referenceInstant;
      }
    }
    return { formattedResult: formattedData, maxInstant };
  }
}
