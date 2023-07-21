import path from 'node:path';

import fetch from 'node-fetch';
import https from 'https';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { formatQueryParams, httpGetWithBody, parsers } from './utils';
import { createFolder, formatInstant, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { SouthOIConnectItemSettings, SouthOIConnectSettings } from '../../../../shared/model/south-settings.model';

/**
 * Class SouthOIConnect - Retrieve data from REST API
 * The results are parsed through the available parsers
 */
export default class SouthOIConnect
  extends SouthConnector<SouthOIConnectSettings, SouthOIConnectItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthOIConnectSettings>,
    items: Array<SouthConnectorItemDTO<SouthOIConnectItemSettings>>,
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
    items: Array<SouthConnectorItemDTO<SouthOIConnectItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<any> = await this.queryData(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      const { formattedResult, maxInstant } = parsers.get(item.settings.payloadParser)!(item, result);

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

  async queryData(item: SouthConnectorItemDTO<SouthOIConnectItemSettings>, startTime: Instant, endTime: Instant): Promise<any> {
    const headers: Record<string, string> = {};
    switch (this.connector.settings.authentication.type) {
      case 'basic': {
        const basic = Buffer.from(
          `${this.connector.settings.authentication.username}:${await this.encryptionService.decryptText(
            this.connector.settings.authentication.password!
          )}`
        ).toString('base64');
        headers.authorization = `Basic ${basic}`;
        break;
      }
      case 'api-key': {
        headers[this.connector.settings.authentication.apiKeyHeader!] = await this.encryptionService.decryptText(
          this.connector.settings.authentication.apiKey!
        );
        break;
      }
      case 'bearer': {
        headers.authorization = `Bearer ${await this.encryptionService.decryptText(this.connector.settings.authentication.token!)}`;
        break;
      }
      default:
        break;
    }

    const apiStartTime = formatInstant(startTime, {
      type: 'string',
      timezone: item.settings.timezone,
      format: item.settings.timestampFormat,
      locale: item.settings.locale
    });
    const apiEndTime = formatInstant(endTime, {
      type: 'string',
      timezone: item.settings.timezone,
      format: item.settings.timestampFormat,
      locale: item.settings.locale
    });

    // Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
    if (item.settings.requestMethod === 'GET' && item.settings.body) {
      const bodyToSend = item.settings.body.replace(/@StartTime/g, `${apiStartTime}`).replace(/@EndTime/g, `${apiEndTime}`);
      headers['Content-Type'] = 'application/json';
      const requestOptions = {
        method: item.settings.requestMethod,
        agent: this.connector.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
        timeout: item.settings.requestTimeout,
        host: this.connector.settings.url,
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
      method: item.settings.requestMethod,
      headers,
      agent: this.connector.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
      timeout: item.settings.requestTimeout
    };
    // TODO @burgerni look into this
    const requestUrl = `${this.connector.settings.url}:${this.connector.settings.port}${item.settings.endpoint}${formatQueryParams(
      startTime,
      endTime,
      (item.settings as any).queryParams
    )}`;

    if (item.settings.body) {
      fetchOptions.body = item.settings.body.replace(/@StartTime/g, `${apiStartTime}`).replace(/@EndTime/g, `${apiEndTime}`);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    this.logger.info(`Requesting data with ${item.settings.requestMethod} method: "${requestUrl}"`);

    const response = await fetch(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
    return response.json();
  }
}
