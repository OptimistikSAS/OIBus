import { DateTime } from 'luxon';

import { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { encryptionService } from '../../service/encryption.service';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import {
  parseRemoteAgentRecords,
  REMOTE_AGENT_DELIMITER,
  REMOTE_AGENT_TIMESTAMP_FORMAT,
  REMOTE_AGENT_TIMEZONE
} from '../../service/remote-agent.utils';
import { convertDateTimeToInstant, formatInstant, getErrorMessage, logQuery, workUnitLogCtx } from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthHistoryQuery } from '../south-interface';

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with OLEDB driver and send them to the cache as record-list content.
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
      // Drain the response body so undici can return the connection to its pool.
      await (await HTTPRequest(requestUrl, fetchOptions)).body.dump();
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
        // Drain the response body so undici can return the connection to its pool.
        await (await HTTPRequest(requestUrl, fetchOptions)).body.dump();
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
      // Drain the response body so undici can return the connection to its pool.
      await (await HTTPRequest(requestUrl, { method: 'DELETE' })).body.dump();
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      // Drain the response body so undici can return the connection to its pool.
      await response.body.dump();
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
    const result = await this.queryRemoteAgentData(item, startTime, endTime);
    const queryDuration = DateTime.now().toMillis() - queryStart;
    return {
      result: { type: 'record-list', content: result },
      // Connect + query happen together inside the query call above — splitting them would mean
      // refactoring a method the scheduled query path also uses, so connectionDuration stays 0 and
      // queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query) and send
   * them to the cache as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOLEDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusRecord | null }> {
    const item = items[0];
    const logCtx = workUnitLogCtx(items);

    const startRequest = DateTime.now();
    const result = await this.queryRemoteAgentData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    let updatedStartTime: Instant | null = null;
    if (result.length > 0) {
      this.logger.info(logCtx, `Found ${result.length} results in ${requestDuration} ms`);
      updatedStartTime = this.trackMaxInstant(item, result);
      await this.addContent({ type: 'record-list', content: result }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
  }

  /**
   * Scan the rows for the configured tracking field and return the max Instant found, used as the
   * cursor for the next incremental query. The agent sends the tracking field as an ISO string in UTC.
   */
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthOLEDBItemSettings>, rows: Array<OIBusRecord>): Instant | null {
    if (!item.settings.trackingInstant?.trackInstant) return null;

    const fieldName = item.settings.trackingInstant.fieldName!;
    let updatedStartTime: Instant | null = null;
    for (const row of rows) {
      const rawValue = row[fieldName];
      if (rawValue === null || rawValue === undefined) continue;
      const instant = convertDateTimeToInstant(rawValue as string | number, { type: 'iso-string' });
      if (instant && (!updatedStartTime || instant > updatedStartTime)) {
        updatedStartTime = instant;
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query through the remote agent, which returns a CSV text parsed back into records.
   * Only `@StartTime`/`@EndTime` query parameters are formatted, using the tracking field's
   * `dateTimeInput` config so they match the source column's native representation. The agent formats
   * the tracking field as an ISO string in UTC (see `REMOTE_AGENT_TIMESTAMP_FORMAT`).
   */
  async queryRemoteAgentData(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    const trackingInstant = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant : null;
    const dateTimeInput = trackingInstant?.dateTimeInput ?? null;
    const oleStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const oleEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger, workUnitLogCtx([item]));
    const { connectionString } = await this.buildConnectionString(this.connector.settings);

    const fetchOptions: ReqOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString,
        sql: adaptedQuery,
        readTimeout: this.connector.settings.requestTimeout,
        timeColumn: trackingInstant?.fieldName,
        datasourceTimestampFormat: dateTimeInput?.format,
        datasourceTimezone: dateTimeInput?.timezone,
        delimiter: REMOTE_AGENT_DELIMITER,
        outputTimestampFormat: REMOTE_AGENT_TIMESTAMP_FORMAT,
        outputTimezone: REMOTE_AGENT_TIMEZONE
      })
    };

    const requestUrl = new URL(`/api/ole/${this.connector.id}/read`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (response.statusCode === 200) {
      const result = (await response.body.json()) as { recordCount: number; content: string; maxInstant: Instant };
      return parseRemoteAgentRecords(result.content);
    }
    if (response.statusCode === 400) {
      // No log here: the base class's runTask() already logs this error with this item's context
      // when it's thrown from the scheduled historyQuery() path; testItem() has no separate logging
      // for its own errors either, consistent with every other connector.
      const errorMessage = await response.body.text();
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
    throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
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
