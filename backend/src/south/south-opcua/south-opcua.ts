import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import { DateTime } from 'luxon';
import { SouthDirectQuery, SouthHistoryQuery, SouthSubscription } from '../south-interface';
import { SouthItemSettings, SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import {
  AttributeIds,
  ClientMonitoredItem,
  ClientSession,
  ClientSubscription,
  DataValue,
  MessageSecurityMode,
  NodeId,
  OPCUAClient,
  resolveNodeId,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType
} from 'node-opcua';
import { HistoryDataOptions, HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import { createSessionConfigs, getHistoryReadRequest, getTimestamp, logMessages, parseOPCUAValue } from '../../service/utils-opcua';

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements SouthHistoryQuery, SouthDirectQuery, SouthSubscription
{
  private disconnecting = false;
  private connecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedValues: Array<{
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
    timestamp: Instant;
    value: number | string;
    quality: string;
  }> = [];
  private client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
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
    this.connecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    try {
      this.client = await this.createSession();
      this.logger.info(`OPCUA South connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the OPCUA server: ${(error as Error).message}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    } finally {
      this.connecting = false;
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.subscription) {
      await this.subscription.terminate();
      this.subscription = null;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const items: Array<{ key: string; value: string }> = [];
    let session: ClientSession | undefined;
    try {
      session = await this.createSession();

      // Attempt to read server state and BuildInfo — gracefully degraded if unavailable
      // Standard OPC UA node IDs per node-opcua-constants (VariableIds enum):
      //   2259 = Server_ServerStatus_State
      //   2261 = Server_ServerStatus_BuildInfo_ProductName
      //   2263 = Server_ServerStatus_BuildInfo_ManufacturerName
      //   2264 = Server_ServerStatus_BuildInfo_SoftwareVersion
      //   2265 = Server_ServerStatus_BuildInfo_BuildNumber
      try {
        const SERVER_STATE_LABELS: Record<number, string> = {
          0: 'Running',
          1: 'Failed',
          2: 'No Configuration',
          3: 'Suspended',
          4: 'Shutdown',
          5: 'Test',
          6: 'Communication Fault',
          7: 'Unknown'
        };
        const nodesToRead = [
          { nodeId: resolveNodeId('ns=0;i=2259'), key: 'State' },
          { nodeId: resolveNodeId('ns=0;i=2263'), key: 'ManufacturerName' },
          { nodeId: resolveNodeId('ns=0;i=2261'), key: 'ProductName' },
          { nodeId: resolveNodeId('ns=0;i=2264'), key: 'SoftwareVersion' },
          { nodeId: resolveNodeId('ns=0;i=2265'), key: 'BuildNumber' }
        ];
        const dataValues = await session.read(nodesToRead.map(n => ({ nodeId: n.nodeId, attributeId: AttributeIds.Value })));
        for (let i = 0; i < nodesToRead.length; i++) {
          const dv = dataValues[i];
          if (dv && dv.statusCode.value === StatusCodes.Good.value && dv.value?.value != null) {
            const raw = dv.value.value;
            let value: string;
            if (nodesToRead[i].key === 'State') {
              value = SERVER_STATE_LABELS[raw as number] ?? String(raw);
            } else {
              value = raw instanceof Date ? raw.toISOString() : String(raw);
            }
            items.push({ key: nodesToRead[i].key, value });
          }
        }
      } catch {
        // Server does not expose BuildInfo — not an error, no diagnostic data added
      }

      try {
        const SECURITY_MODE_LABELS: Partial<Record<MessageSecurityMode, string>> = {
          [MessageSecurityMode.None]: 'None',
          [MessageSecurityMode.Sign]: 'Sign',
          [MessageSecurityMode.SignAndEncrypt]: 'SignAndEncrypt'
        };
        const AUTH_TYPE_LABELS: Partial<Record<UserTokenType, string>> = {
          [UserTokenType.Anonymous]: 'Anonymous',
          [UserTokenType.UserName]: 'Username/Password',
          [UserTokenType.Certificate]: 'X509 Certificate',
          [UserTokenType.IssuedToken]: 'IssuedToken'
        };

        const endpointClient = OPCUAClient.create({
          applicationName: 'OIBus',
          connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
          endpointMustExist: false
        });
        try {
          await endpointClient.connect(this.connector.settings.url);
          const endpoints = await endpointClient.getEndpoints();

          const securityModes = [...new Set(endpoints.map(e => SECURITY_MODE_LABELS[e.securityMode] ?? String(e.securityMode)))].filter(
            Boolean
          );
          items.push({ key: 'SecurityModes', value: securityModes.join(', ') });

          const securityPolicies = [
            ...new Set(
              endpoints
                .map(e => {
                  const uri = e.securityPolicyUri ?? '';
                  const hashIdx = uri.lastIndexOf('#');
                  return hashIdx >= 0 ? uri.substring(hashIdx + 1) : uri;
                })
                .filter(Boolean)
            )
          ];
          if (securityPolicies.length) items.push({ key: 'SecurityPolicies', value: securityPolicies.join(', ') });

          const authModes = [
            ...new Set(endpoints.flatMap(e => (e.userIdentityTokens ?? []).map(t => AUTH_TYPE_LABELS[t.tokenType] ?? String(t.tokenType))))
          ];
          if (authModes.length) items.push({ key: 'AuthenticationModes', value: authModes.join(', ') });
        } finally {
          await endpointClient.disconnect();
        }
      } catch {
        // Server may not expose endpoint details
      }

      try {
        const browseResult = await session.browse('ns=0;i=11201');
        const aggregates = (browseResult.references ?? [])
          .map(ref => ref.displayName?.text)
          .filter((text): text is string => Boolean(text));
        if (aggregates.length) items.push({ key: 'SupportedAggregates', value: aggregates.join(', ') });
      } catch {
        // Server does not expose aggregate functions
      }
    } finally {
      if (session) {
        await session.close();
      }
    }

    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    let session;
    try {
      session = await this.createSession();
      if (item.settings.mode === 'da') {
        const nodeId = resolveNodeId(item.settings.nodeId);
        const result = await this.getDAValues([{ nodeId, name: item.name, settings: item.settings }], session);
        return { type: 'time-values', content: result };
      } else {
        const result = await this.getHAValues([item], testingSettings.history!.startTime, testingSettings.history!.endTime, session, true);
        return { type: 'time-values', content: result.value ? [result.value] : [] };
      }
    } finally {
      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(
      item =>
        item.settings.mode === 'ha' &&
        ((item.syncWithGroup && item.group && item.group.scanMode.id !== 'subscription') ||
          (!(item.syncWithGroup && item.group) && item.scanMode!.id !== 'subscription'))
    );
  }

  override filterDirectItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(
      item =>
        item.settings.mode === 'da' &&
        ((item.syncWithGroup && item.group && item.group.scanMode.id !== 'subscription') ||
          (!(item.syncWithGroup && item.group) && item.scanMode!.id !== 'subscription'))
    );
  }

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.connector.settings.readTimeout
    );
    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
    const session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
    this.logger.info(`OPCUA connector "${this.connector.name}" connected`);
    return session;
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    try {
      if (!this.client) {
        throw new Error('OPCUA client not set');
      }
      return await this.getHAValues(items, startTime, endTime, this.client);
    } catch (error: unknown) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
  }

  async getHAValues(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    session: ClientSession,
    testingItem = false
  ): Promise<{ trackedInstant: Instant | null; value: OIBusTimeValue | null }> {
    let lastValue: OIBusTimeValue | null = null;
    // Track the most-recent timestamp in epoch-ms so we can compare numerically
    // and avoid re-parsing lastValue.timestamp ISO string on every history value.
    let lastValueTimestampMs = -Infinity;
    const itemsByAggregates = new Map<
      Aggregate,
      Map<Resampling | undefined, Array<{ nodeId: NodeId; item: SouthConnectorItemEntity<SouthOPCUAItemSettings> }>>
    >();

    for (const item of items) {
      let nodeId;
      try {
        nodeId = resolveNodeId(item.settings.nodeId);
      } catch (error: unknown) {
        this.logger.error(`Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${(error as Error).message}`);
        continue;
      }

      // Normalise resampling: null and undefined both mean "no resampling" and must
      // map to the same bucket so items aren't split into separate historyRead requests.
      const aggregate = item.settings.haMode!.aggregate;
      const resampling = item.settings.haMode!.resampling ?? undefined;

      if (!itemsByAggregates.has(aggregate)) {
        itemsByAggregates.set(
          aggregate,
          new Map<
            Resampling,
            Array<{
              nodeId: NodeId;
              item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
            }>
          >()
        );
      }
      const resamplingMap = itemsByAggregates.get(aggregate)!;
      if (!resamplingMap.has(resampling)) {
        resamplingMap.set(resampling, [{ nodeId, item }]);
      } else {
        resamplingMap.get(resampling)!.push({ nodeId, item });
      }
    }

    for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
      for (const [resampling, resampledItems] of aggregatedItems.entries()) {
        const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();

        // Each entry carries its associated item alongside the node descriptor so
        // we can look up the item by index (O(1)) instead of via .find() per result
        // (which was O(N²) per response). The .filter() below preserves the pairing
        // for continuation-point round-trips.
        let nodesToRead: Array<{
          nodeToRead: HistoryReadValueIdOptions;
          item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
        }> = resampledItems.map(({ nodeId, item }) => ({
          nodeToRead: {
            continuationPoint: undefined,
            dataEncoding: undefined,
            indexRange: undefined,
            nodeId
          },
          item
        }));
        const totalNodes = resampledItems.length;
        // Hoist once instead of rebuilding per continuation-point round-trip
        const resampledItemsAsItems = resampledItems.map(({ item }) => item);
        this.logger.trace(`Reading ${totalNodes} items with aggregate ${aggregate} and resampling ${resampling}`);
        do {
          const batchValues: Array<OIBusTimeValue> = [];
          const startRequest = DateTime.now();
          const request = getHistoryReadRequest(
            startTime,
            endTime,
            aggregate,
            resampling,
            nodesToRead.map(n => n.nodeToRead)
          );
          const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
          this.logger.debug(`HA request done in ${requestDuration} ms`);
          request.requestHeader.timeoutHint = this.connector.settings.readTimeout;

          const response = await session.historyRead(request);
          if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
            this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
          }

          if (response.results) {
            this.logger.debug(
              `Received a response of ${response.results.length}/${totalNodes} nodes` +
                (response.results.length < totalNodes ? ` (${totalNodes - response.results.length} completed in a previous batch)` : '')
            );

            nodesToRead = nodesToRead
              .map(({ nodeToRead: node, item: associatedItem }, i) => {
                const result = response.results![i];

                if (
                  ![StatusCodes.Good.value, StatusCodes.GoodNoData.value, StatusCodes.GoodMoreData.value].includes(result.statusCode.value)
                ) {
                  if (!logs.has(result.statusCode.name)) {
                    logs.set(result.statusCode.name, {
                      description: result.statusCode.description,
                      affectedNodes: [associatedItem.name]
                    });
                  } else {
                    logs.get(result.statusCode.name)!.affectedNodes.push(associatedItem.name);
                  }
                } else if (result.historyData && (result.historyData as HistoryDataOptions).dataValues) {
                  const historyDataValues = (result.historyData as HistoryDataOptions).dataValues!.filter(
                    value => value
                  ) as Array<DataValue>;
                  // Per-node-per-batch hot path inside HistoryRead loop. Gate the
                  // template-literal interpolation (including NodeId.toString) so it
                  // only runs when a transport actually accepts trace.
                  if (this.logger.isLevelEnabled('trace')) {
                    this.logger.trace(
                      `Result for node "${node.nodeId}" (number ${i}) contains ` +
                        `${historyDataValues.length} values and has status code ` +
                        `${result.statusCode.name}, continuation point is ${result.continuationPoint}`
                    );
                  }
                  for (const historyValue of historyDataValues) {
                    const value = parseOPCUAValue(associatedItem.name, historyValue.value, this.logger);
                    if (!value) {
                      continue;
                    }
                    const selectedTimestamp = historyValue.sourceTimestamp ?? historyValue.serverTimestamp;
                    const selectedTimestampMs = selectedTimestamp!.getTime();
                    const timeValue: OIBusTimeValue = {
                      pointId: associatedItem.name,
                      timestamp: selectedTimestamp!.toISOString(),
                      data: {
                        value,
                        quality: historyValue.statusCode.name
                      }
                    };
                    batchValues.push(timeValue);
                    if (selectedTimestampMs > lastValueTimestampMs) {
                      lastValue = timeValue;
                      lastValueTimestampMs = selectedTimestampMs;
                    }
                  }
                }

                return {
                  nodeToRead: { ...node, continuationPoint: result.continuationPoint },
                  item: associatedItem,
                  status: result.statusCode,
                  hasData:
                    result.historyData &&
                    (result.historyData as HistoryDataOptions).dataValues &&
                    (result.historyData as HistoryDataOptions).dataValues!.length > 0
                };
              })
              .filter(
                entry =>
                  entry.hasData &&
                  [StatusCodes.Good.value, StatusCodes.GoodNoData.value, StatusCodes.GoodMoreData.value].includes(entry.status.value) &&
                  entry.nodeToRead.continuationPoint &&
                  entry.nodeToRead.continuationPoint.length > 0
              );

            this.logger.debug(`Adding ${batchValues.length} values between ${startTime} and ${endTime}`);
            if (!testingItem) {
              await this.addContent({ type: 'time-values', content: batchValues }, startRequest.toUTC().toISO(), resampledItemsAsItems);
              this.logger.trace(`Continue read for ${nodesToRead.length}/${totalNodes} nodes with pending data`);
            }
          } else {
            this.logger.error('No result found in response');
            nodesToRead = [];
          }
        } while (nodesToRead.length > 0);

        // If all is retrieved, clear continuation points
        const releaseRequest = getHistoryReadRequest(
          startTime,
          endTime,
          aggregate,
          resampling,
          resampledItems.map(({ nodeId }) => ({
            continuationPoint: undefined,
            dataEncoding: undefined,
            indexRange: undefined,
            nodeId
          }))
        );
        releaseRequest.releaseContinuationPoints = true;
        const response = await session.historyRead(releaseRequest);

        if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
          this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
        }
        logMessages(logs, this.logger);
      }
    }

    // TypeScript's control-flow analysis can't see assignments inside the .map()
    // callback above, so it narrows lastValue to its initial type (null) here.
    // The `as` cast disables narrowing for the use site.
    const result = lastValue as OIBusTimeValue | null;
    return {
      trackedInstant: result?.timestamp ?? null,
      value: result
    };
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<OIBusTimeValue | null> {
    const nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }> = [];
    let content: Array<OIBusTimeValue> = [];
    for (const item of items) {
      if (item.settings.mode === 'da') {
        let nodeId;
        try {
          nodeId = resolveNodeId(item.settings.nodeId);
          nodesToRead.push({ nodeId, name: item.name, settings: item.settings });
        } catch (error: unknown) {
          this.logger.error(`Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${(error as Error).message}`);
        }
      }
    }
    if (nodesToRead.length === 0) {
      return null;
    } else if (nodesToRead.length > 1) {
      this.logger.debug(`Read ${nodesToRead.length} nodes ` + `[${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`);
    } else {
      this.logger.debug(`Read node ${nodesToRead[0].nodeId}`);
    }
    try {
      if (!this.client) {
        throw new Error('OPCUA client not set');
      }

      const queryTime = DateTime.now().toUTC().toISO();
      content = await this.getDAValues(nodesToRead, this.client);
      await this.addContent({ type: 'time-values', content }, queryTime, items);
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
    return content && content.length > 0 ? content[content.length - 1] : null;
  }

  async getDAValues(
    nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }>,
    session: ClientSession
  ): Promise<Array<OIBusTimeValue>> {
    const startRequest = DateTime.now().toMillis();
    const dataValues = await session.read(nodesToRead);
    const requestDuration = DateTime.now().toMillis() - startRequest;
    this.logger.debug(`Found ${dataValues.length} results for ${nodesToRead.length} items (DA mode) in ${requestDuration} ms`);
    if (dataValues.length !== nodesToRead.length) {
      this.logger.error(
        `Received ${dataValues.length} node results, requested ${nodesToRead.length} nodes. Request done in ${requestDuration} ms`
      );
    }

    const oibusTimestamp = DateTime.now().toUTC().toISO();
    const values: Array<OIBusTimeValue> = dataValues
      .map((dataValue: DataValue, i) => {
        const selectedTimestamp = getTimestamp(dataValue, nodesToRead[i].settings, oibusTimestamp);
        return {
          pointId: nodesToRead[i].name,
          timestamp: selectedTimestamp,
          data: {
            value: parseOPCUAValue(nodesToRead[i].name, dataValue.value, this.logger),
            quality: dataValue.statusCode.name
          }
        };
      })
      .filter(parsedValue => parsedValue.data.value);
    return values;
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    if (!items.length) {
      return;
    }
    if (!this.client) {
      throw new Error('OPCUA client not set');
    }

    if (!this.subscription) {
      this.subscription = await this.client.createSubscription2({
        requestedPublishingInterval: 150,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 0,
        publishingEnabled: true,
        priority: 10
      });
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
    }

    for (const item of items) {
      if (this.monitoredItems.has(item.id)) {
        continue;
      }
      let nodeId;
      try {
        nodeId = resolveNodeId(item.settings.nodeId);
      } catch (error: unknown) {
        this.logger.error(`Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${(error as Error).message}`);
        continue;
      }
      const monitoredItem = await this.subscription.monitor(
        {
          nodeId,
          attributeId: AttributeIds.Value
        },
        {
          samplingInterval: -1,
          discardOldest: true,
          queueSize: 10
        },
        TimestampsToReturn.Neither
      );
      monitoredItem.on('changed', async (dataValue: DataValue) => {
        const parsedValue = parseOPCUAValue(item.name, dataValue.value, this.logger);
        if (parsedValue) {
          this.bufferedValues.push({
            item: item,
            timestamp: DateTime.now().toUTC().toISO(),
            value: parsedValue,
            quality: dataValue.statusCode.name
          });
          if (this.bufferedValues.length >= this.connector.settings.maxNumberOfMessages) {
            await this.flushMessages();
          }
        }
      });
      this.monitoredItems.set(item.id, monitoredItem);
    }
  }

  async flushMessages(): Promise<void> {
    // Swap-and-walk: take ownership of the current buffer in O(1) and let the
    // subscription handler accumulate into a fresh one. Avoids the Array.from copy.
    const valuesToSend = this.bufferedValues;
    this.bufferedValues = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (valuesToSend.length) {
      this.logger.debug(`Flushing ${valuesToSend.length} messages`);
      try {
        const content = new Array<OIBusTimeValue>(valuesToSend.length);
        const uniqueItems = new Set<SouthConnectorItemEntity<SouthOPCUAItemSettings>>();
        for (let i = 0; i < valuesToSend.length; i++) {
          const element = valuesToSend[i];
          content[i] = {
            pointId: element.item.name,
            timestamp: element.timestamp,
            data: { value: element.value, quality: element.quality }
          };
          uniqueItems.add(element.item);
        }
        await this.addContent({ type: 'time-values', content }, DateTime.now().toUTC().toISO(), Array.from(uniqueItems));
      } catch (error: unknown) {
        this.logger.error(`Error when flushing messages: ${(error as Error).message}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
  }

  async unsubscribe(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    for (const item of items) {
      if (this.monitoredItems.has(item.id)) {
        this.monitoredItems.get(item.id)!.removeAllListeners();
        await this.monitoredItems.get(item.id)!.terminate();
        this.monitoredItems.delete(item.id);
      }
    }
  }
}
