import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import pino from 'pino';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QueriesHistory, QueriesLastPoint, QueriesSubscription, SharableConnection } from '../south-interface';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import {
  AggregateFunction,
  AttributeIds,
  ClientMonitoredItem,
  ClientSession,
  ClientSubscription,
  DataType,
  DataValue,
  HistoryReadRequest,
  NodeId,
  OPCUACertificateManager,
  OPCUAClient,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  resolveNodeId,
  StatusCodes,
  TimestampsToReturn,
  Variant
} from 'node-opcua';
import { HistoryDataOptions, HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import { connectionService } from '../../service/connection.service';

export const MAX_NUMBER_OF_NODE_TO_LOG = 10;
export const NUM_VALUES_PER_NODE = 1000;

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements QueriesHistory, QueriesLastPoint, QueriesSubscription, SharableConnection<ClientSession>
{
  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedValues: Array<OIBusTimeValue> = [];
  private client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, engineAddContentCallback, southConnectorRepository, southCacheRepository, scanModeRepository, logger, baseFolders);
  }

  override async start(dataStream = true): Promise<void> {
    await initOPCUACertificateFolders(this.baseFolders.cache);
    if (!this.clientCertificateManager) {
      this.clientCertificateManager = new OPCUACertificateManager({
        rootFolder: path.resolve(this.baseFolders.cache, 'opcua'),
        automaticallyAcceptUnknownCertificate: true
      });
      // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
      // It is useful for offline instances of OIBus where downloading openssl is not possible
      this.clientCertificateManager.state = 2;
    }
    await super.start(dataStream);
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      await this.getSession();
      this.logger.info(`OPCUA South connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the OPCUA server: ${(error as Error).message}`);
      await this.disconnect(error as Error);
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
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

    try {
      await this.getSession();
    } finally {
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
      await this.disconnect();
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOPCUACertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    try {
      let content: OIBusContent;
      const session = await this.getSession();
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
      callback(content);
    } finally {
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
      await this.disconnect();
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(item => item.settings.mode === 'ha');
  }

  async getSession(): Promise<ClientSession> {
    if (!this.client) {
      if (!this.connector.settings.sharedConnection) {
        this.client = await this.createSession();
      } else {
        this.client = await connectionService.getConnection<ClientSession>(
          this.connector.settings.sharedConnection.connectorType,
          this.connector.settings.sharedConnection.connectorId
        );
      }
    }
    if (!this.client) {
      throw new Error('Could not connect client');
    }
    return this.client;
  }

  async closeSession(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  getSharedConnectionSettings(): { connectorType: 'north' | 'south' | undefined; connectorId: string | undefined } {
    return {
      connectorType: this.connector.settings.sharedConnection?.connectorType,
      connectorId: this.connector.settings.sharedConnection?.connectorId
    };
  }

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.clientCertificateManager!,
      this.connector.settings.readTimeout
    );
    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.connectionSettings!.url}`);
    const session = await OPCUAClient.createSession(this.connector.settings.connectionSettings!.url, userIdentity, options);
    this.logger.debug(`Connected to OPCUA server ${this.connector.settings.connectionSettings!.url}`);
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
      const session = await this.getSession();
      return (await this.getHAValues(items, startTime, endTime, session)) as Instant;
    } catch (error: unknown) {
      await this.disconnect(error as Error);
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
          const request = this.getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
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
                    const value = this.parseOPCUAValue(associatedItem.name, historyValue.value);
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

        const historyRequest = this.getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
        historyRequest.releaseContinuationPoints = true;
        const response = await session.historyRead(historyRequest);

        if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
          this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
        }
        for (const [statusCode, log] of logs.entries()) {
          if (log.affectedNodes.length > MAX_NUMBER_OF_NODE_TO_LOG) {
            this.logger.debug(
              `${statusCode} status code (${log.description}): [${log.affectedNodes[0]}..${
                log.affectedNodes[log.affectedNodes.length - 1]
              }]`
            );
          } else {
            this.logger.debug(`${log.description} with status code ${statusCode}: [${log.affectedNodes.toString()}]`);
          }
        }
      }
    }

    const requestDuration = DateTime.now().toMillis() - startRequest;
    this.logger.debug(`HA request done in ${requestDuration} ms`);
    if (testingItem) {
      return { type: 'time-values', content: dataByItems };
    }
    return maxTimestamp ? DateTime.fromMillis(maxTimestamp).toUTC().toISO() : null;
  }

  override async disconnect(error?: Error): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.subscription) {
      await this.subscription.terminate();
      this.subscription = null;
    }
    if (this.client && (!connectionService.isConnectionUsed('south', this.connector.id, this.connector.id) || error)) {
      if (!this.connector.settings.sharedConnection) {
        await this.closeSession();
      } else {
        await connectionService.closeSession(
          this.connector.settings.sharedConnection.connectorType,
          this.connector.settings.sharedConnection.connectorId,
          this.connector.id,
          error !== undefined
        );
      }
    }
    this.client = null;
    await this.flushMessages();
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await super.disconnect(error);
    this.disconnecting = false;
  }

  getHistoryReadRequest(
    startTime: Instant,
    endTime: Instant,
    aggregate: string,
    resampling: string | undefined,
    nodesToRead: Array<HistoryReadValueIdOptions>
  ): HistoryReadRequest {
    let historyReadDetails: ReadRawModifiedDetails | ReadProcessedDetails;
    switch (aggregate) {
      case 'average':
        historyReadDetails = new ReadProcessedDetails({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Average),
          processingInterval: this.getResamplingValue(resampling)
        });
        break;
      case 'minimum':
        historyReadDetails = new ReadProcessedDetails({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Minimum),
          processingInterval: this.getResamplingValue(resampling)
        });
        break;
      case 'maximum':
        historyReadDetails = new ReadProcessedDetails({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Maximum),
          processingInterval: this.getResamplingValue(resampling)
        });
        break;
      case 'count':
        historyReadDetails = new ReadProcessedDetails({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Count),
          processingInterval: this.getResamplingValue(resampling)
        });
        break;
      case 'raw':
      default:
        historyReadDetails = new ReadRawModifiedDetails({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          isReadModified: false,
          returnBounds: false,
          numValuesPerNode: NUM_VALUES_PER_NODE
        });
        break;
    }
    return new HistoryReadRequest({
      historyReadDetails,
      nodesToRead,
      releaseContinuationPoints: false,
      timestampsToReturn: TimestampsToReturn.Both
    });
  }

  getResamplingValue(resampling: string | undefined): number | undefined {
    switch (resampling) {
      case 'second':
        return 1000;
      case '10Seconds':
        return 1000 * 10;
      case '30Seconds':
        return 1000 * 30;
      case 'minute':
        return 1000 * 60;
      case 'hour':
        return 1000 * 3600;
      case 'day':
        return 1000 * 3600 * 24;
      case 'none':
      default:
        return undefined;
    }
  }

  async lastPointQuery(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    try {
      const session = await this.getSession();
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
        this.logger.debug(
          `Read ${nodesToRead.length} nodes ` + `[${nodesToRead[0].nodeId}...${nodesToRead[nodesToRead.length - 1].nodeId}]`
        );
      } else {
        this.logger.debug(`Read node ${nodesToRead[0].nodeId}`);
      }
      const content = await this.getDAValues(nodesToRead, session);
      await this.addContent(content);
    } catch (error: unknown) {
      await this.disconnect(error as Error);
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
    this.logger.debug(`Found ${dataValues.length} node results for ${nodesToRead.length} items (DA mode) in ${requestDuration} ms`);
    if (dataValues.length !== nodesToRead.length) {
      this.logger.error(
        `Received ${dataValues.length} node results, requested ${nodesToRead.length} nodes. Request done in ${requestDuration} ms`
      );
    }

    const oibusTimestamp = DateTime.now().toUTC().toISO();
    const values = dataValues
      .map((dataValue: DataValue, i) => {
        const selectedTimestamp = this.getTimestamp(dataValue, nodesToRead[i].settings, oibusTimestamp);
        return {
          pointId: nodesToRead[i].name,
          timestamp: selectedTimestamp,
          data: {
            value: this.parseOPCUAValue(nodesToRead[i].name, dataValue.value),
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

    // Try to get a session
    try {
      await this.getSession();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting into OPCUA server: ${(error as Error).message}`);
      return;
    }

    if (!this.subscription) {
      this.subscription = await this.client!.createSubscription2({
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
        const parsedValue = this.parseOPCUAValue(item.name, dataValue.value);
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
        this.logger.error(`Error when flushing messages: ${error}`);
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

  parseOPCUAValue(itemName: string, opcuaVariant: Variant): string {
    switch (opcuaVariant.dataType) {
      case DataType.String:
        return opcuaVariant.value.split('\0')[0];
      case DataType.Float:
      case DataType.Double:
      case DataType.SByte:
      case DataType.Int16:
      case DataType.Int32:
      case DataType.Byte:
      case DataType.UInt16:
      case DataType.UInt32:
        return opcuaVariant.value.toString();

      case DataType.UInt64:
        return Buffer.concat([
          new Uint8Array(Uint32Array.of(opcuaVariant.value[0]).buffer).reverse(),
          new Uint8Array(Uint32Array.of(opcuaVariant.value[1]).buffer).reverse()
        ])
          .readBigUInt64BE()
          .toString();
      case DataType.Int64:
        return Buffer.concat([
          new Uint8Array(Uint32Array.of(opcuaVariant.value[0]).buffer).reverse(),
          new Uint8Array(Uint32Array.of(opcuaVariant.value[1]).buffer).reverse()
        ])
          .readBigInt64BE()
          .toString();

      case DataType.ByteString:
        return opcuaVariant.value.toString('hex');

      case DataType.Boolean:
        return opcuaVariant.value ? '1' : '0';

      case DataType.DateTime:
        return DateTime.fromJSDate(opcuaVariant.value).toUTC().toISO()!;

      case DataType.Null:
        return '';

      case DataType.Variant:
      case DataType.DataValue:
      case DataType.DiagnosticInfo:
      case DataType.ExpandedNodeId:
      case DataType.ExtensionObject:
      case DataType.XmlElement:
      case DataType.NodeId:
      case DataType.LocalizedText:
      case DataType.QualifiedName:
      case DataType.Guid:
      case DataType.StatusCode:
        this.logger.debug(`Item ${itemName} with value ${opcuaVariant.value} of type ${opcuaVariant.dataType} could not be parsed`);
        return '';
    }
  }

  private getTimestamp(dataValue: DataValue, settings: SouthOPCUAItemSettings, oibusTimestamp: Instant): Instant {
    switch (settings.timestampOrigin) {
      case 'point':
        return dataValue.sourceTimestamp ? dataValue.sourceTimestamp.toISOString() : oibusTimestamp;
      case 'server':
        return dataValue.serverTimestamp ? dataValue.serverTimestamp.toISOString() : oibusTimestamp;
      default:
        return oibusTimestamp;
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
