import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import pino from 'pino';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QueriesHistory, QueriesLastPoint, QueriesSubscription } from '../south-interface';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import {
  AttributeIds,
  ClientMonitoredItem,
  ClientSession,
  ClientSubscription,
  DataValue,
  NodeId,
  OPCUACertificateManager,
  OPCUAClient,
  resolveNodeId,
  StatusCodes,
  TimestampsToReturn
} from 'node-opcua';
import { HistoryDataOptions, HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import {
  createSessionConfigs,
  getHistoryReadRequest,
  getTimestamp,
  initOPCUACertificateFolders,
  logMessages,
  parseOPCUAValue
} from '../../service/utils-opcua';

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements QueriesHistory, QueriesLastPoint, QueriesSubscription
{
  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  private connecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedValues: Array<OIBusTimeValue> = [];
  private client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async start(): Promise<void> {
    await initOPCUACertificateFolders(this.cacheFolderPath);
    if (!this.clientCertificateManager) {
      this.clientCertificateManager = new OPCUACertificateManager({
        rootFolder: path.resolve(this.cacheFolderPath, 'opcua'),
        automaticallyAcceptUnknownCertificate: true
      });
      // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
      // It is useful for offline instances of OIBus where downloading openssl is not possible
      this.clientCertificateManager.state = 2;
    }
    await super.start();
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

  override async testConnection(): Promise<void> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOPCUACertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    let session;
    try {
      session = await this.createSession();
    } finally {
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOPCUACertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    let session;
    try {
      session = await this.createSession();
      let content: OIBusContent;
      if (item.settings.mode === 'da') {
        const nodeId = resolveNodeId(item.settings.nodeId);
        content = await this.getDAValues([{ nodeId, name: item.name, settings: item.settings }], session);
      } else {
        content = (await this.getHAValues(
          [item],
          testingSettings.history!.startTime,
          testingSettings.history!.endTime,
          session,
          true
        )) as OIBusContent;
      }
      return content;
    } finally {
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(item => item.settings.mode === 'ha');
  }

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.clientCertificateManager!,
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
  ): Promise<Instant | null> {
    try {
      if (!this.client) {
        throw new Error('OPCUA client not set');
      }
      return (await this.getHAValues(items, startTime, endTime, this.client)) as Instant;
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
  ): Promise<Instant | OIBusContent | null> {
    let maxTimestamp: number | null = null;
    const itemsByAggregates = new Map<
      Aggregate,
      Map<Resampling | undefined, Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }>>
    >();

    for (const item of items) {
      let nodeId;
      try {
        nodeId = resolveNodeId(item.settings.nodeId);
      } catch (error: unknown) {
        this.logger.error(`Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${(error as Error).message}`);
        continue;
      }

      if (!itemsByAggregates.has(item.settings.haMode!.aggregate)) {
        itemsByAggregates.set(
          item.settings.haMode!.aggregate,
          new Map<
            Resampling,
            Array<{
              nodeId: NodeId;
              name: string;
              settings: SouthOPCUAItemSettings;
            }>
          >()
        );
      }
      if (!itemsByAggregates.get(item.settings.haMode!.aggregate!)!.has(item.settings.haMode!.resampling)) {
        itemsByAggregates
          .get(item.settings.haMode!.aggregate)!
          .set(item.settings.haMode!.resampling, [{ name: item.name, nodeId, settings: item.settings }]);
      } else {
        const currentList = itemsByAggregates.get(item.settings.haMode!.aggregate)!.get(item.settings.haMode!.resampling)!;
        currentList.push({ name: item.name, nodeId, settings: item.settings });
        itemsByAggregates.get(item.settings.haMode!.aggregate)!.set(item.settings.haMode!.resampling, currentList);
      }
    }

    const startRequest = DateTime.now().toMillis();
    let dataByItems: Array<OIBusTimeValue> = [];
    for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
      for (const [resampling, resampledItems] of aggregatedItems.entries()) {
        const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();

        let nodesToRead: Array<HistoryReadValueIdOptions> = resampledItems.map(item => ({
          continuationPoint: undefined,
          dataEncoding: undefined,
          indexRange: undefined,
          nodeId: item.nodeId
        }));
        this.logger.trace(`Reading ${resampledItems.length} items with aggregate ${aggregate} and resampling ${resampling}`);
        do {
          const request = getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
          request.requestHeader.timeoutHint = this.connector.settings.readTimeout;

          const response = await session.historyRead(request);
          if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
            this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
          }

          if (response.results) {
            this.logger.debug(`Received a response of ${response.results.length} nodes`);

            nodesToRead = nodesToRead
              .map((node, i) => {
                const result = response.results![i];
                const associatedItem = resampledItems.find(item => item.nodeId === node.nodeId)!;

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
                  this.logger.trace(
                    `Result for node "${node.nodeId}" (number ${i}) contains ` +
                      `${historyDataValues.length} values and has status code ` +
                      `${result.statusCode.name}, continuation point is ${result.continuationPoint}`
                  );
                  for (const historyValue of historyDataValues) {
                    const value = parseOPCUAValue(associatedItem.name, historyValue.value, this.logger);
                    if (!value) {
                      continue;
                    }
                    const selectedTimestamp = historyValue.sourceTimestamp ?? historyValue.serverTimestamp;
                    maxTimestamp =
                      !maxTimestamp || selectedTimestamp!.getTime() > maxTimestamp ? selectedTimestamp!.getTime() : maxTimestamp;
                    dataByItems.push({
                      pointId: associatedItem.name,
                      timestamp: selectedTimestamp!.toISOString(),
                      data: {
                        value,
                        quality: historyValue.statusCode.name
                      }
                    });
                  }
                }

                return {
                  ...node,
                  continuationPoint: result.continuationPoint,
                  status: result.statusCode,
                  hasData:
                    result.historyData &&
                    (result.historyData as HistoryDataOptions).dataValues &&
                    (result.historyData as HistoryDataOptions).dataValues!.length > 0
                };
              })
              .filter(
                node =>
                  node.hasData &&
                  [StatusCodes.Good.value, StatusCodes.GoodNoData.value, StatusCodes.GoodMoreData.value].includes(node.status.value) &&
                  node.continuationPoint &&
                  node.continuationPoint.length > 0
              );

            this.logger.debug(`Adding ${dataByItems.length} values between ${startTime} and ${endTime}`);
            if (!testingItem) {
              await this.addContent({ type: 'time-values', content: dataByItems });
              dataByItems = [];
              this.logger.trace(`Continue read for ${nodesToRead.length} points`);
            }
          } else {
            this.logger.error('No result found in response');
            nodesToRead = [];
          }
        } while (nodesToRead.length > 0);

        // If all is retrieved, clear continuation points
        nodesToRead = resampledItems.map(item => ({
          continuationPoint: undefined,
          dataEncoding: undefined,
          indexRange: undefined,
          nodeId: item.nodeId
        }));

        const historyRequest = getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
        historyRequest.releaseContinuationPoints = true;
        const response = await session.historyRead(historyRequest);

        if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
          this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
        }
        logMessages(logs, this.logger);
      }
    }

    const requestDuration = DateTime.now().toMillis() - startRequest;
    this.logger.debug(`HA request done in ${requestDuration} ms`);
    if (testingItem) {
      return { type: 'time-values', content: dataByItems };
    }
    return maxTimestamp ? DateTime.fromMillis(maxTimestamp).toUTC().toISO() : null;
  }

  async lastPointQuery(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    const nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }> = [];
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
      return;
    } else if (nodesToRead.length > 1) {
      this.logger.debug(`Read ${nodesToRead.length} nodes ` + `[${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`);
    } else {
      this.logger.debug(`Read node ${nodesToRead[0].nodeId}`);
    }
    try {
      if (!this.client) {
        throw new Error('OPCUA client not set');
      }

      const content = await this.getDAValues(nodesToRead, this.client);
      await this.addContent(content);
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
  }

  async getDAValues(
    nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }>,
    session: ClientSession
  ): Promise<OIBusContent> {
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
    const values = dataValues
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
    return { type: 'time-values', content: values };
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
            pointId: item.name,
            timestamp: DateTime.now().toUTC().toISO()!,
            data: {
              value: parsedValue,
              quality: dataValue.statusCode.name
            }
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
    const valuesToSend = Array.from(this.bufferedValues);
    this.bufferedValues = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (valuesToSend.length) {
      this.logger.debug(`Flushing ${valuesToSend.length} messages`);
      try {
        await this.addContent({
          type: 'time-values',
          content: valuesToSend
        });
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

  getThrottlingSettings(settings: SouthOPCUASettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(settings: SouthOPCUASettings): boolean {
    return settings.throttling.maxInstantPerItem;
  }

  getOverlap(settings: SouthOPCUASettings): number {
    return settings.throttling.overlap;
  }
}
