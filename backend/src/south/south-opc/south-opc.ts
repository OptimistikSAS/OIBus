import SouthConnector from '../south-connector';
import pino from 'pino';
import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';

/**
 * Class SouthOPC - Run an OPC agent to connect to an OPC server.
 * This connector communicates with the Agent through an HTTP connection
 */
export default class SouthOPC extends SouthConnector<SouthOPCSettings, SouthOPCItemSettings> implements QueriesHistory {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const fetchOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: this.connector.settings.host,
          serverName: this.connector.settings.serverName,
          mode: this.connector.settings.mode
        })
      };

      const requestUrl = new URL(`/api/opc/${this.connector.id}/connect`, this.connector.settings.agentUrl);
      await HTTPRequest(requestUrl, fetchOptions);
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<void> {
    const fetchOptions: ReqOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName,
        mode: this.connector.settings.mode
      })
    };

    const connectUrl = new URL(`/api/opc/${this.connector.id}-test/connect`, this.connector.settings.agentUrl);
    const connectResponse = await HTTPRequest(connectUrl, fetchOptions);

    if (connectResponse.statusCode === 200) {
      const statusUrl = new URL(`/api/opc/${this.connector.id}-test/status`, this.connector.settings.agentUrl);
      const response = await HTTPRequest(statusUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      this.logger.info(`OPC server info: ${await response.body.json()}`);

      const disconnectUrl = new URL(`/api/opc/${this.connector.id}-test/disconnect`, this.connector.settings.agentUrl);
      await HTTPRequest(disconnectUrl, { method: 'DELETE' });
    } else if (connectResponse.statusCode === 400) {
      const errorMessage = await connectResponse.body.text();
      throw new Error(
        `Error occurred when sending connect command to remote agent with status ${connectResponse.statusCode}. ${errorMessage}`
      );
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${connectResponse.statusCode}`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const content: OIBusContent = { type: 'time-values', content: [] };
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;

    const fetchOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName,
        mode: this.connector.settings.mode,
        aggregate: item.settings.aggregate,
        resampling: item.settings.resampling,
        startTime,
        endTime,
        items: [{ nodeId: item.settings.nodeId, name: item.name }]
      })
    };

    const requestUrl = new URL(`/api/opc/${this.connector.id}-test/read`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);

    if (response.statusCode === 200) {
      const result: {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        maxInstantRetrieved: Instant;
      } = (await response.body.json()) as {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        maxInstantRetrieved: string;
      };
      content.content = result.content;
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent. ${response.statusCode}`);
    }
    return content;
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    try {
      let updatedStartTime: Instant | null = null;
      const itemsByAggregates = new Map<
        Aggregate,
        Map<
          Resampling | undefined,
          Array<{
            nodeId: string;
            name: string;
            id: string;
          }>
        >
      >();
      items.forEach(item => {
        if (!itemsByAggregates.has(item.settings.aggregate)) {
          itemsByAggregates.set(
            item.settings.aggregate,
            new Map<
              Resampling,
              Array<{
                nodeId: string;
                name: string;
                id: string;
              }>
            >()
          );
        }
        const resampling = item.settings.resampling ? item.settings.resampling : 'none';
        if (!itemsByAggregates.get(item.settings.aggregate!)!.has(resampling)) {
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, [
            {
              name: item.name,
              nodeId: item.settings.nodeId,
              id: item.id
            }
          ]);
        } else {
          const currentList = itemsByAggregates.get(item.settings.aggregate)!.get(resampling)!;
          currentList.push({ name: item.name, nodeId: item.settings.nodeId, id: item.id });
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, currentList);
        }
      });

      for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
        for (const [resampling, resampledItems] of aggregatedItems.entries()) {
          this.logger.debug(
            `Requesting ${resampledItems.length} items with aggregate ${aggregate} and resampling ${resampling} between ${startTime} and ${endTime}`
          );
          const startRequest = DateTime.now();

          const fetchOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: this.connector.settings.host,
              serverName: this.connector.settings.serverName,
              mode: this.connector.settings.mode,
              maxReadValues: 3600,
              intervalReadDelay: 200,
              aggregate,
              resampling,
              startTime,
              endTime,
              items: resampledItems.map(item => ({ name: item.name, nodeId: item.nodeId }))
            })
          };
          const requestUrl = new URL(`/api/opc/${this.connector.id}/read`, this.connector.settings.agentUrl);
          const response = await HTTPRequest(requestUrl, fetchOptions);
          if (response.statusCode === 200) {
            const result: {
              recordCount: number;
              content: Array<OIBusTimeValue>;
              maxInstantRetrieved: Instant;
            } = (await response.body.json()) as {
              recordCount: number;
              content: Array<OIBusTimeValue>;
              maxInstantRetrieved: string;
            };
            const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

            if (result.recordCount > 0) {
              this.logger.debug(
                `Found ${result.recordCount} results for ${resampledItems.length} items in ${requestDuration} ms. Max instant retrieved: ${result.maxInstantRetrieved}`
              );
              await this.addContent({ type: 'time-values', content: result.content }, startRequest.toUTC().toISO(), [
                ...new Set(resampledItems.map(item => item.id))
              ]);
              if (result.maxInstantRetrieved > startTime) {
                // 1ms is added to the maxInstantRetrieved, so it does not take the last retrieve value on the last run
                updatedStartTime = DateTime.fromISO(result.maxInstantRetrieved).plus({ millisecond: 1 }).toUTC().toISO()!;
              }
            } else {
              this.logger.debug(`No result found. Request done in ${requestDuration} ms`);
            }
          } else if (response.statusCode === 400) {
            const errorMessage = await response.body.text();
            this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
            throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
          } else {
            this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}`);
            throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
          }
        }
      }
      return updatedStartTime;
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  getThrottlingSettings(settings: SouthOPCSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(settings: SouthOPCSettings): boolean {
    return settings.throttling.maxInstantPerItem;
  }

  getOverlap(settings: SouthOPCSettings): number {
    return settings.throttling.overlap;
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connected) {
      try {
        const fetchOptions = { method: 'DELETE' };
        const requestUrl = new URL(`/api/opc/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }
}
