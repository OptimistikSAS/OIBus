import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDelimiter, createFolder, formatInstant, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../../shared/model/south-settings.model';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with OLEDB driver and send them to the cache as CSV files.
 */

export default class SouthOLEDB extends SouthConnector<SouthOLEDBSettings, SouthOLEDBItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthOLEDBSettings>,
    items: Array<SouthConnectorItemDTO<SouthOLEDBItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusDataValue>) => Promise<void>,
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

  override async connect(): Promise<void> {
    try {
      this.connected = false;
      const headers: Record<string, string> = {};
      headers['Content-Type'] = 'application/json';
      const fetchOptions = {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: this.connector.settings.connectionString,
          connectionTimeout: this.connector.settings.connectionTimeout
        }),
        headers
      };
      await fetch(`${this.connector.settings.agentUrl}/api/ole/${this.connector.id}/connect`, fetchOptions);
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = null;

    if (this.connected) {
      try {
        const fetchOptions = { method: 'DELETE' };
        await fetch(`${this.connector.settings.agentUrl}/api/ole/${this.connector.id}/disconnect`, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
  }

  override async testConnection(): Promise<void> {
    // Has to connect through agent
    await this.testAgentConnection();
  }

  async testAgentConnection(): Promise<void> {
    this.logger.info(
      `Testing OLE OIBus Agent connection on ${this.connector.settings.agentUrl} with "${this.connector.settings.connectionString}"`
    );

    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: this.connector.settings.connectionString,
        connectionTimeout: this.connector.settings.connectionTimeout
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl!}/api/ole/${this.connector.id}/connect`, fetchOptions);
    if (response.status === 200) {
      this.logger.info('Connected to remote ole. Disconnecting...');
      await fetch(`${this.connector.settings.agentUrl}/api/ole/${this.connector.id}/disconnect`, { method: 'DELETE' });
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      this.logger.error(`Error occurred when sending connect command to remote agent with status ${response.status}: ${errorMessage}`);
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when sending connect command to remote agent with status ${response.status}`);
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}`);
    }
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthOLEDBItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      // Has to query through a remote agent
      updatedStartTime = await this.queryRemoteAgentData(item, updatedStartTime, endTime);
    }
    return updatedStartTime;
  }

  async queryRemoteAgentData(item: SouthConnectorItemDTO<SouthOLEDBItemSettings>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;
    const startRequest = DateTime.now().toMillis();

    const headers: HeadersInit = {};
    headers['Content-Type'] = 'application/json';

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const oleStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const oleEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger);

    const fetchOptions: RequestInit = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: this.connector.settings.connectionString,
        sql: adaptedQuery,
        readTimeout: this.connector.settings.requestTimeout,
        timeColumn: referenceTimestampField?.fieldName,
        datasourceTimestampFormat: referenceTimestampField?.format,
        datasourceTimezone: referenceTimestampField?.timezone,
        delimiter: convertDelimiter(item.settings.serialization.delimiter)
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl}/api/ole/${this.connector.id}/read`, fetchOptions);
    if (response.status === 200) {
      const result: { recordCount: number; content: Array<any>; maxInstantRetrieved: Instant } = (await response.json()) as {
        recordCount: number;
        content: OIBusDataValue[];
        maxInstantRetrieved: string;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.info(`Found ${result.recordCount} results for item ${item.name} in ${requestDuration} ms`);

      if (result.content.length > 0) {
        await persistResults(
          result.content,
          { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
          this.connector.name,
          this.tmpFolder,
          this.addFile.bind(this),
          this.addValues.bind(this),
          this.logger
        );
        if (result.maxInstantRetrieved > updatedStartTime) {
          updatedStartTime = result.maxInstantRetrieved;
        }
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}`);
    }

    return updatedStartTime;
  }
}
