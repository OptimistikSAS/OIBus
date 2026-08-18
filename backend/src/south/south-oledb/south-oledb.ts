import SouthConnector from '../south-connector';
import {
  convertDelimiter,
  extractLastCsvRow,
  formatInstant,
  generateFilenameForSerialization,
  getErrorMessage,
  logQuery,
  persistResults,
  workUnitLogCtx
} from '../../service/utils';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { encryptionService } from '../../service/encryption.service';

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with OLEDB driver and send them to the cache as CSV files.
 */

export default class SouthOLEDB extends SouthConnector<SouthOLEDBSettings, SouthOLEDBItemSettings> implements SouthHistoryQuery {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    try {
      this.connected = false;
      this.logger.debug(`Connecting to OLE agent at ${this.connector.settings.agentUrl}`);
      const connectStart = DateTime.now().toMillis();
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
      this.logger.info(`Connected to OLE agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
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
      const disconnectStart = DateTime.now().toMillis();
      try {
        const fetchOptions = { method: 'DELETE' };
        const requestUrl = new URL(`/api/ole/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
        this.logger.info(
          `Disconnected from OLE agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - disconnectStart} ms`
        );
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent: ${getErrorMessage(error)}`);
      }
    }
    this.connected = false;
    await super.disconnect();
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const { connectionString, logValue } = await this.buildConnectionString(this.connector.settings);
    this.logger.debug(`Connecting to OLE agent at ${this.connector.settings.agentUrl} with "${logValue}"`);
    const connectStart = DateTime.now().toMillis();

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
      this.logger.info(`Connected to OLE agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - connectStart} ms`);
      const requestUrl = new URL(`/api/ole/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
      await HTTPRequest(requestUrl, { method: 'DELETE' });
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}`);
    }
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const queryStart = DateTime.now().toMillis();
    const result = await this.queryRemoteAgentData(item, startTime, endTime, true);
    const queryDuration = DateTime.now().toMillis() - queryStart;

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        oibusContent = { type: 'any', filePath, content: result.value as string };
        break;
      }
    }
    return {
      result: oibusContent,
      // Connect + query happen together inside the query call above — splitting them would mean
      // refactoring a method the scheduled query path also uses, so connectionDuration stays 0 and
      // queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOLEDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    return await this.queryRemoteAgentData(items[0], startTime, endTime);
  }

  async queryRemoteAgentData(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const logCtx = workUnitLogCtx([item]);
    let updatedStartTime: Instant | null = null;
    const startRequest = DateTime.now();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const oleStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const oleEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger, logCtx);
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
    let result: { recordCount: number; content: string; maxInstant: Instant };
    if (response.statusCode === 200) {
      result = (await response.body.json()) as {
        recordCount: number;
        content: string;
        maxInstant: Instant;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
      this.logger.info(logCtx, `Found ${result.recordCount} results in ${requestDuration} ms`);

      if (!test) {
        if (result.recordCount > 0) {
          await persistResults(
            result.content,
            { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
            this.connector.name,
            item,
            startRequest.toUTC().toISO(),
            this.tmpFolder,
            this.addContent.bind(this),
            this.logger
          );
          if (result.maxInstant > startTime) {
            updatedStartTime = result.maxInstant;
          }
        } else {
          this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
        }
      }
    } else if (response.statusCode === 400) {
      // No log here: the base class's runTask() already logs this error with this item's context
      // when it's thrown from the scheduled historyQuery() path; testItem() has no separate logging
      // for its own errors either, consistent with every other connector.
      const errorMessage = await response.body.text();
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
    }
    // For the data stream we only keep the last row as the cached "last value"; the full CSV content
    // is only needed for the item test, where it is returned to the UI as-is.
    return {
      trackedInstant: updatedStartTime,
      value: test ? result.content : extractLastCsvRow(result.content, convertDelimiter(item.settings.serialization.delimiter))
    };
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
