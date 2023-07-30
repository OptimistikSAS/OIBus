import path from 'node:path';

import fetch from 'node-fetch';
import https from 'https';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import {
  createFolder,
  formatInstant,
  persistResults,
  formatQueryParams,
  httpGetWithBody,
  convertDateTimeToInstant
} from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { SouthSlimsItemSettings, SouthSlimsSettings } from '../../../../shared/model/south-settings.model';

export interface SlimsColumn {
  name: string;
  value: any;
  unit?: string;
}

export interface SlimsEntity {
  columns: Array<SlimsColumn>;
}

export interface SlimsResults {
  entities: Array<SlimsEntity>;
}

/**
 * Class SouthSlims - Retrieve data from SLIMS REST API
 */
export default class SouthSlims
  extends SouthConnector<SouthSlimsSettings, SouthSlimsItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthSlimsSettings>,
    items: Array<SouthConnectorItemDTO<SouthSlimsItemSettings>>,
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
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthSlimsItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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

  async queryData(item: SouthConnectorItemDTO<SouthSlimsItemSettings>, startTime: Instant, endTime: Instant): Promise<SlimsResults> {
    const headers: Record<string, string | number> = {};
    const basic = Buffer.from(
      `${this.connector.settings.authentication.username}:${await this.encryptionService.decryptText(
        this.connector.settings.authentication.password!
      )}`
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference) || null;
    const slimsStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const slimsEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);

    // SLIMS uses a body with GET. It's not standard and requires a specific implementation
    if (item.settings.body) {
      const bodyToSend = item.settings.body.replace(/@StartTime/g, `${slimsStartTime}`).replace(/@EndTime/g, `${slimsEndTime}`);
      headers['content-type'] = 'application/json';
      headers['content-length'] = bodyToSend.length;
      let host: string = this.connector.settings.url;
      let protocol = 'http:';
      if (this.connector.settings.url.startsWith('http://')) {
        host = this.connector.settings.url.substring(7);
      } else if (this.connector.settings.url.startsWith('https://')) {
        host = this.connector.settings.url.substring(8);
        protocol = 'https:';
      }
      const requestOptions = {
        method: 'GET',
        agent: this.connector.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
        timeout: item.settings.requestTimeout,
        host,
        protocol,
        port: this.connector.settings.port,
        path: item.settings.endpoint,
        headers
      };

      this.logger.info(
        `Requesting data with GET method and body on: "${requestOptions.host}:${requestOptions.port}${requestOptions.path}"`
      );

      return httpGetWithBody(bodyToSend, requestOptions);
    }

    const fetchOptions: Record<string, any> = {
      method: 'GET',
      headers,
      agent: this.connector.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
      timeout: item.settings.requestTimeout
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
    return response.json();
  }

  /**
   * Parse data from SLIMS Result table
   * Return the formatted results flattened for easier access
   * (into csv files for example) and the latestDateRetrieved in ISO String format
   */
  parseData(
    item: SouthConnectorItemDTO<SouthSlimsItemSettings>,
    httpResult: SlimsResults
  ): {
    formattedResult: Array<any>;
    maxInstant: Instant;
  } {
    if (!httpResult?.entities || !Array.isArray(httpResult.entities)) {
      throw new Error('Bad data: expect SLIMS values to be an array.');
    }
    const formattedData: Array<any> = [];
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

      const samplingDatetimeField = item.settings.dateTimeFields.find(
        dateTimeField => dateTimeField.fieldName === 'rslt_cf_samplingDateAndTime'
      );
      if (!samplingDatetimeField) {
        throw new Error('Bad config: expect rslt_cf_samplingDateAndTime to have an associated date time fields (see item)');
      }
      const resultInstant = convertDateTimeToInstant(rsltCfSamplingDateAndTime.value, samplingDatetimeField);

      const referenceDatetimeField = item.settings.dateTimeFields.find(
        dateTimeField => dateTimeField.fieldName === 'rslt_modifiedOn' && dateTimeField.useAsReference
      );
      if (!referenceDatetimeField) {
        throw new Error('Bad config: expect to have a reference field (rslt_modifiedOn) in date time fields (see item)');
      }
      const referenceInstant = convertDateTimeToInstant(rsltModifiedOn.value, referenceDatetimeField);

      formattedData.push({
        pointId: `${rsltCfPid.value}-${testName.value}`,
        unit: rsltValue.unit || 'Ø',
        timestamp: formatInstant(resultInstant, { type: 'iso-string' }),
        value: rsltValue.value
      });
      if (referenceInstant > maxInstant) {
        maxInstant = referenceInstant;
      }
    }
    return { formattedResult: formattedData, maxInstant };
  }
}
