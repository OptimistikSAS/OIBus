import SouthConnector from '../south-connector';
import { convertDelimiter, formatInstant, generateFilenameForSerialization, logQuery, persistResults } from '../../service/utils';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { encryptionService } from '../../service/encryption.service';

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with OLEDB driver and send them to the cache as CSV files.
 */

export default class SouthOLEDB extends SouthConnector<SouthOLEDBSettings, SouthOLEDBItemSettings> implements QueriesHistory {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    try {
      this.connected = false;
      const { connectionString } = await this.buildConnectionString(this.connector.settings);
      const fetchOptions: ReqOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          connectionTimeout: this.connector.settings.connectionTimeout
        })
      };
      const requestUrl = new URL(`/api/ole/${this.connector.id}/connect`, this.connector.settings.agentUrl);
      await HTTPRequest(requestUrl, fetchOptions);
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
        const requestUrl = new URL(`/api/ole/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
  }

  override async testConnection(): Promise<void> {
    const { connectionString, logValue } = await this.buildConnectionString(this.connector.settings);
    this.logger.info(`Testing OLE OIBus Agent connection on ${this.connector.settings.agentUrl} with "${logValue}"`);

    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString,
        connectionTimeout: this.connector.settings.connectionTimeout
      })
    };
    const requestUrl = new URL(`/api/ole/${this.connector.id}/connect`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (response.statusCode === 200) {
      this.logger.info('Connected to remote ole. Disconnecting...');
      const requestUrl = new URL(`/api/ole/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
      await HTTPRequest(requestUrl, { method: 'DELETE' });
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      this.logger.error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}: ${errorMessage}`);
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}`);
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result = (await this.queryRemoteAgentData(item, startTime, endTime, true)) as string;

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        oibusContent = { type: 'any', filePath, content: result };
        break;
      }
    }
    return oibusContent;
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOLEDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      // Has to query through a remote agent
      updatedStartTime = (await this.queryRemoteAgentData(item, startTime, endTime)) as string;
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthOLEDBSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthOLEDBSettings): boolean {
    return true;
  }

  getOverlap(settings: SouthOLEDBSettings): number {
    return settings.throttling.overlap;
  }

  async queryRemoteAgentData(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<Instant | string | null> {
    let updatedStartTime: Instant | null = null;
    const startRequest = DateTime.now().toMillis();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const oleStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const oleEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger);
    const { connectionString } = await this.buildConnectionString(this.connector.settings);

    const fetchOptions: ReqOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString,
        sql: adaptedQuery,
        readTimeout: this.connector.settings.requestTimeout,
        timeColumn: referenceTimestampField?.fieldName,
        datasourceTimestampFormat: referenceTimestampField?.format,
        datasourceTimezone: referenceTimestampField?.timezone,
        delimiter: convertDelimiter(item.settings.serialization.delimiter),
        outputTimestampFormat: item.settings.serialization.outputTimestampFormat,
        outputTimezone: item.settings.serialization.outputTimezone
      })
    };

    const requestUrl = new URL(`/api/ole/${this.connector.id}/read`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (response.statusCode === 200) {
      const result: { recordCount: number; content: string; maxInstant: Instant } = (await response.body.json()) as {
        recordCount: number;
        content: string;
        maxInstant: Instant;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.info(`Found ${result.recordCount} results for item ${item.name} in ${requestDuration} ms`);

      if (test) {
        return result.content;
      } else {
        if (result.recordCount > 0) {
          await persistResults(
            result.content,
            { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
            this.connector.name,
            item.name,
            this.tmpFolder,
            this.addContent.bind(this),
            this.logger
          );
          if (result.maxInstant > startTime) {
            updatedStartTime = result.maxInstant;
          }
        } else {
          this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
        }
      }
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
    }

    return updatedStartTime;
  }

  private async buildConnectionString(settings: SouthOLEDBSettings): Promise<{ connectionString: string; logValue: string }> {
    let connectionString = settings.connectionString.trimEnd();
    let logValue = connectionString;

    if (settings.password) {
      if (!connectionString.endsWith(';')) {
        connectionString += ';';
        logValue += ';';
      }
      const decryptedPassword = await encryptionService.decryptText(settings.password);
      connectionString += `Password=${decryptedPassword};`;
      logValue += 'Password=<secret>;';
    }

    return { connectionString, logValue };
  }
}
