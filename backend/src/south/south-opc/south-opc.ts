import SouthConnector from '../south-connector';
import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';

/**
 * Class SouthOPC - Run an OPC agent to connect to an OPC server.
 * This connector communicates with the Agent through an HTTP connection
 */
export default class SouthOPC extends SouthConnector<SouthOPCSettings, SouthOPCItemSettings> implements SouthHistoryQuery {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings>,
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

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.logger.debug(`Connecting to OPC agent at ${this.connector.settings.agentUrl}`);
      const connectStart = DateTime.now().toMillis();
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
      this.logger.info(`Connected to OPC agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
      );
      // Guarded together (not just the reschedule): disconnect() resets `disconnecting` to false at
      // its own end, so calling it re-entrantly while an outer disconnect()/stop() is still in
      // flight would cut that outer call's "disconnecting" state short.
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    this.logger.debug(`Connecting to OPC agent at ${this.connector.settings.agentUrl}`);
    const connectStart = DateTime.now().toMillis();
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
      this.logger.info(`Connected to OPC agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - connectStart} ms`);
      const statusUrl = new URL(`/api/opc/${this.connector.id}-test/status`, this.connector.settings.agentUrl);
      const response = await HTTPRequest(statusUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      this.logger.info(`OPC server info: ${JSON.stringify(await response.body.json())}`);

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
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
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
    const queryStart = DateTime.now().toMillis();
    const response = await HTTPRequest(requestUrl, fetchOptions);
    const queryDuration = DateTime.now().toMillis() - queryStart;

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
    return {
      result: content,
      // No separate connection step in testItem() for this connector — the call above does
      // connect + query together, so connectionDuration stays 0 and queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const logCtx = workUnitLogCtx(items);
    let updatedStartTime: Instant | null = null;
    let result: {
      recordCount: number;
      content: Array<OIBusTimeValue>;
      maxInstantRetrieved: Instant;
    } | null = null;
    try {
      const itemsByAggregates = new Map<
        Aggregate,
        Map<
          Resampling | undefined,
          Array<{
            nodeId: string;
            item: SouthConnectorItemEntity<SouthOPCItemSettings>;
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
                item: SouthConnectorItemEntity<SouthOPCItemSettings>;
              }>
            >()
          );
        }
        const resampling = item.settings.resampling ? item.settings.resampling : 'none';
        if (!itemsByAggregates.get(item.settings.aggregate!)!.has(resampling)) {
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, [
            {
              nodeId: item.settings.nodeId,
              item
            }
          ]);
        } else {
          const currentList = itemsByAggregates.get(item.settings.aggregate)!.get(resampling)!;
          currentList.push({ nodeId: item.settings.nodeId, item });
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, currentList);
        }
      });

      for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
        for (const [resampling, resampledItems] of aggregatedItems.entries()) {
          // OPC classic's HTTP agent returns values keyed only by pointId/name (result.content),
          // decoupled from the full item entity, so the item lookup is rebuilt here per sub-batch
          // from resampledItems' {nodeId, item} tuples (the one place in this method that still has
          // the full entity) and used to join values back to items just before addContent.
          const itemByName = new Map<string, SouthConnectorItemEntity<SouthOPCItemSettings>>();
          resampledItems.forEach(({ item }) => itemByName.set(item.name, item));

          this.logger.debug(
            logCtx,
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
              items: resampledItems.map(item => ({ name: item.item.name, nodeId: item.nodeId }))
            })
          };
          const requestUrl = new URL(`/api/opc/${this.connector.id}/read`, this.connector.settings.agentUrl);
          const response = await HTTPRequest(requestUrl, fetchOptions);
          if (response.statusCode === 200) {
            result = (await response.body.json()) as {
              recordCount: number;
              content: Array<OIBusTimeValue>;
              maxInstantRetrieved: string;
            };
            const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

            if (result.recordCount > 0) {
              this.logger.debug(
                logCtx,
                `Found ${result.recordCount} results for ${resampledItems.length} items in ${requestDuration} ms. Max instant retrieved: ${result.maxInstantRetrieved}`
              );

              // Join each returned value back to its item through the name-keyed map, then apply the
              // item's per-item caching strategy against its last cached state (batch-read once per
              // sub-batch, not per value) before the existing addContent call. Only items that are
              // actually cached this cycle are passed to saveItemsLastValues below, so "last cached"
              // is anchored correctly rather than reset on every raw reading.
              const valuePairs: Array<{ item: SouthConnectorItemEntity<SouthOPCItemSettings>; value: OIBusTimeValue }> = [];
              for (const value of result.content) {
                const item = itemByName.get(value.pointId);
                if (item) {
                  valuePairs.push({ item, value });
                }
              }

              // applyCachingStrategy keeps its own in-call shadow up to date as entries are
              // accepted, so multiple points for the same pointId within one resampled/aggregate
              // response batch compare against each other correctly, not a stale pre-batch state.
              const cachedPairs = this.applyCachingStrategy(valuePairs, ({ item, value }) => ({
                item,
                value: value.data.value,
                timestamp: value.timestamp
              }));

              await this.addContent(
                { type: 'time-values', content: cachedPairs.map(({ value }) => value) },
                startRequest.toUTC().toISO(),
                cachedPairs.map(({ item }) => item)
              );
              if (result.maxInstantRetrieved > startTime) {
                // 1ms is added to the maxInstantRetrieved, so it does not take the last retrieve value on the last run
                updatedStartTime = DateTime.fromISO(result.maxInstantRetrieved).plus({ millisecond: 1 }).toUTC().toISO()!;
              }
            } else {
              this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
            }
          } else if (response.statusCode === 400) {
            // No log here: the base class's runTask() already logs this error with this item's/group's
            // context when it's thrown from the scheduled historyQuery() path.
            const errorMessage = await response.body.text();
            throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
          } else {
            throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
          }
        }
      }
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
    return { trackedInstant: updatedStartTime, value: result };
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connected) {
      const disconnectStart = DateTime.now().toMillis();
      try {
        const fetchOptions = { method: 'DELETE' };
        const requestUrl = new URL(`/api/opc/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
        this.logger.info(
          `Disconnected from OPC agent at ${this.connector.settings.agentUrl} in ${DateTime.now().toMillis() - disconnectStart} ms`
        );
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent: ${getErrorMessage(error)}`);
      }
    }
    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }
}
