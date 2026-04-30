import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SouthDirectQuery, SouthHistoryQuery, SouthSubscription } from '../south-interface';
import { SouthItemSettings, SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
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
  OPCUACertificateManager,
  OPCUAClient,
  resolveNodeId,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType
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
import type { ILogger } from '../../model/logger.model';

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements SouthHistoryQuery, SouthDirectQuery, SouthSubscription
{
  private clientCertificateManager: OPCUACertificateManager | null = null;
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
    logger: ILogger,
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

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOPCUACertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;
    this.clientCertificateManager = clientCertificateManager;

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
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
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
      if (item.settings.mode === 'da') {
        const nodeId = resolveNodeId(item.settings.nodeId);
        const result = await this.getDAValues([{ nodeId, name: item.name, settings: item.settings }], session);
        return { type: 'time-values', content: result };
      } else {
        const result = await this.getHAValues([item], testingSettings.history!.startTime, testingSettings.history!.endTime, session, true);
        return { type: 'time-values', content: result.value };
      }
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
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    try {
      if (!this.client) {
        throw new Error('OPCUA client not set');
      }
      const result = await this.getHAValues(items, startTime, endTime, this.client);
      return {
        trackedInstant: result.trackedInstant,
        value: result.value.length > 0 ? result.value[result.value.length - 1] : null
      };
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
  ): Promise<{ trackedInstant: Instant | null; value: Array<OIBusTimeValue> }> {
    let maxTimestamp: number | null = null;
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

      if (!itemsByAggregates.has(item.settings.haMode!.aggregate)) {
        itemsByAggregates.set(
          item.settings.haMode!.aggregate,
          new Map<
            Resampling,
            Array<{
              nodeId: NodeId;
              item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
            }>
          >()
        );
      }
      if (!itemsByAggregates.get(item.settings.haMode!.aggregate!)!.has(item.settings.haMode!.resampling)) {
        itemsByAggregates.get(item.settings.haMode!.aggregate)!.set(item.settings.haMode!.resampling, [{ nodeId, item }]);
      } else {
        const currentList = itemsByAggregates.get(item.settings.haMode!.aggregate)!.get(item.settings.haMode!.resampling)!;
        currentList.push({ nodeId, item });
        itemsByAggregates.get(item.settings.haMode!.aggregate)!.set(item.settings.haMode!.resampling, currentList);
      }
    }

    let values: Array<OIBusTimeValue> = [];
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
          const startRequest = DateTime.now();
          const request = getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
          const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
          this.logger.debug(`HA request done in ${requestDuration} ms`);
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
                      affectedNodes: [associatedItem.item.name]
                    });
                  } else {
                    logs.get(result.statusCode.name)!.affectedNodes.push(associatedItem.item.name);
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
                    const value = parseOPCUAValue(associatedItem.item.name, historyValue.value, this.logger);
                    if (!value) {
                      continue;
                    }
                    const selectedTimestamp = historyValue.sourceTimestamp ?? historyValue.serverTimestamp;
                    maxTimestamp =
                      !maxTimestamp || selectedTimestamp!.getTime() > maxTimestamp ? selectedTimestamp!.getTime() : maxTimestamp;
                    values.push({
                      pointId: associatedItem.item.name,
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

            this.logger.debug(`Adding ${values.length} values between ${startTime} and ${endTime}`);
            if (!testingItem) {
              await this.addContent(
                { type: 'time-values', content: values },
                startRequest.toUTC().toISO(),
                resampledItems.map(item => item.item)
              );
              values = [];
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

    return {
      trackedInstant: maxTimestamp ? DateTime.fromMillis(maxTimestamp).toUTC().toISO() : null,
      value: values
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
    const valuesToSend = Array.from(this.bufferedValues);
    this.bufferedValues = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (valuesToSend.length) {
      this.logger.debug(`Flushing ${valuesToSend.length} messages`);
      try {
        await this.addContent(
          {
            type: 'time-values',
            content: valuesToSend.map(element => ({
              pointId: element.item.name,
              timestamp: element.timestamp,
              data: { value: element.value, quality: element.quality }
            }))
          },
          DateTime.now().toUTC().toISO(),
          [...new Set(valuesToSend.map(element => element.item))]
        );
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
