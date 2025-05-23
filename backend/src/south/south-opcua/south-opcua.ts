import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import EncryptionService, { CERT_FILE_NAME, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME } from '../../service/encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DelegatesConnection, QueriesHistory, QueriesLastPoint, QueriesSubscription } from '../south-interface';
import {
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOPCUASettingsSecurityMode,
  SouthOPCUASettingsSecurityPolicy
} from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import { createFolder } from '../../service/utils';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import ConnectionService, { ManagedConnection, ManagedConnectionSettings } from '../../service/connection.service';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import {
  AttributeIds,
  ClientMonitoredItem,
  ClientSubscription,
  DataValue,
  OPCUAClient,
  OPCUAClientOptions,
  UserIdentityInfo,
  UserTokenType,
  Variant,
  AggregateFunction,
  DataType,
  HistoryReadRequest,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn,
  ClientSession,
  OPCUACertificateManager
} from 'node-opcua';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';

export const MAX_NUMBER_OF_NODE_TO_LOG = 10;
export const NUM_VALUES_PER_NODE = 1000;

function toOPCUASecurityMode(securityMode: SouthOPCUASettingsSecurityMode) {
  switch (securityMode) {
    case 'none':
      return 1;
    case 'sign':
      return 2;
    case 'sign-and-encrypt':
      return 3;
  }
}

function toOPCUASecurityPolicy(securityPolicy: SouthOPCUASettingsSecurityPolicy | null | undefined) {
  switch (securityPolicy) {
    case 'none':
      return 'none';
    case 'basic128':
      return 'Basic128';
    case 'basic192':
      return 'Basic192';
    case 'basic192-rsa15':
      return 'Basic192Rsa15';
    case 'basic256-rsa15':
      return 'Basic256Rsa15';
    case 'basic256-sha256':
      return 'Basic256Sha256';
    case 'aes128-sha256-rsa-oaep':
      return 'Aes128_Sha256_RsaOaep';
    case 'pub-sub-aes-128-ctr':
      return 'PubSub_Aes128_CTR';
    case 'pub-sub-aes-256-ctr':
      return 'PubSub_Aes256_CTR';
    default:
      return undefined;
  }
}

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements QueriesHistory, QueriesLastPoint, QueriesSubscription, DelegatesConnection<ClientSession>
{
  // TODO: add these as settings
  private MAX_NUMBER_OF_MESSAGES = 1000;
  private FLUSH_MESSAGE_TIMEOUT = 1000;

  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  connectionSettings: ManagedConnectionSettings<ClientSession>;
  connection!: ManagedConnection<ClientSession>;
  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedValues: Array<OIBusTimeValue> = [];

  constructor(
    connector: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders,
    connectionService: ConnectionService
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolders,
      connectionService
    );

    this.connectionSettings = {
      closeFnName: 'close',
      sharedConnection: connector.settings.sharedConnection
    };
  }

  override async start(dataStream = true): Promise<void> {
    await this.initOpcuaCertificateFolders(this.baseFolders.cache);
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

  override async testConnection(): Promise<void> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await this.initOpcuaCertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    let session;
    try {
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        clientCertificateManager,
        this.encryptionService,
        'OIBus Connector test'
      );
      session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
    } catch (error: unknown) {
      const message = (error as Error).message;

      if (/BadTcpEndpointUrlInvalid/i.test(message)) {
        throw new Error('Please check the URL');
      }

      // Security policy
      if (/Cannot find an Endpoint matching {1,2}security mode/i.test(message) && this.connector.settings.securityPolicy) {
        throw new Error(`Security Policy "${this.connector.settings.securityPolicy}" is not supported on the server`);
      }
      if (/The connection may have been rejected by server/i.test(message) && this.connector.settings.securityPolicy !== 'none') {
        throw new Error('Please check if the OIBus certificate has been trusted by the server');
      }

      // Authentication
      if (/BadIdentityTokenRejected/i.test(message)) {
        if (this.connector.settings.authentication.type === 'basic') {
          throw new Error('Please check username and password');
        }

        if (this.connector.settings.authentication.type === 'cert') {
          throw new Error('Please check the certificate and key');
        }
      }

      if (/Failed to read private key/i.test(message)) {
        const keyPath = path.resolve(this.connector.settings.authentication.keyFilePath!);
        throw new Error(`Could not read private key "${keyPath}"`);
      }

      // Unhandled errors
      throw new Error((error as Error).message);
    } finally {
      await fs.rm(tempCertFolder, { recursive: true, force: true });

      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await this.initOpcuaCertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    let session;
    try {
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        clientCertificateManager,
        this.encryptionService,
        'OIBus Connector test'
      );
      session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      let content: OIBusContent;
      if (item.settings.mode === 'da') {
        content = await this.getDAValues([item], session);
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
    } catch (error: unknown) {
      this.logger.error(`Error when testing item: ${(error as Error).message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(item => item.settings.mode === 'ha');
  }

  async createSession(): Promise<ClientSession | null> {
    try {
      const clientName = this.connectionSettings.sharedConnection ? 'Shared session' : this.connector.id;
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        this.clientCertificateManager!,
        this.encryptionService,
        clientName
      );

      this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
      const session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      this.logger.info(`OPCUA ${this.connector.name} connected`);
      return session;
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA server. ${error}`);
      return null;
    }
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    // Try to get a session
    const session = await this.connection.getSession();
    return (await this.getHAValues(items, startTime, endTime, session)) as Instant;
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

  async getHAValues(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    session: ClientSession,
    testingItem = false
  ): Promise<Instant | OIBusContent | null> {
    try {
      let maxTimestamp: number | null = null;
      const itemsByAggregates = new Map<Aggregate, Map<Resampling | undefined, Array<{ nodeId: string; itemName: string }>>>();

      items.forEach(item => {
        if (!itemsByAggregates.has(item.settings.haMode!.aggregate)) {
          itemsByAggregates.set(
            item.settings.haMode!.aggregate,
            new Map<
              Resampling,
              Array<{
                nodeId: string;
                itemName: string;
              }>
            >()
          );
        }
        if (!itemsByAggregates.get(item.settings.haMode!.aggregate!)!.has(item.settings.haMode!.resampling)) {
          itemsByAggregates
            .get(item.settings.haMode!.aggregate)!
            .set(item.settings.haMode!.resampling, [{ itemName: item.name, nodeId: item.settings.nodeId }]);
        } else {
          const currentList = itemsByAggregates.get(item.settings.haMode!.aggregate)!.get(item.settings.haMode!.resampling)!;
          currentList.push({ itemName: item.name, nodeId: item.settings.nodeId });
          itemsByAggregates.get(item.settings.haMode!.aggregate)!.set(item.settings.haMode!.resampling, currentList);
        }
      });

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
            const request: HistoryReadRequest = this.getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead);
            request.requestHeader.timeoutHint = this.connector.settings.readTimeout;

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            const response = await session.performMessageTransaction(request);
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
              this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
            }

            if (response.results) {
              this.logger.debug(`Received a response of ${response.results.length} nodes`);
              nodesToRead = nodesToRead
                .map((node, i) => {
                  const result = response.results[i];
                  const associatedItem = resampledItems.find(item => item.nodeId === node.nodeId)!;

                  // Reason of statusCode not equal to zero could be there is no data for the requested data and interval
                  if (result.statusCode !== StatusCodes.Good) {
                    if (!logs.has(result.statusCode.name)) {
                      logs.set(result.statusCode.name, {
                        description: result.statusCode.description,
                        affectedNodes: [associatedItem.itemName]
                      });
                    } else {
                      logs.get(result.statusCode.name)!.affectedNodes.push(associatedItem.itemName);
                    }
                  } else if (result.historyData && result.historyData.dataValues) {
                    this.logger.trace(
                      `Result for node "${node.nodeId}" (number ${i}) contains ` +
                        `${result.historyData.dataValues.length} values and has status code ` +
                        `${result.statusCode.name}, continuation point is ${result.continuationPoint}`
                    );
                    for (const historyValue of result.historyData.dataValues) {
                      const selectedTimestamp = historyValue.sourceTimestamp ?? historyValue.serverTimestamp;
                      maxTimestamp =
                        !maxTimestamp || selectedTimestamp!.getTime() > maxTimestamp ? selectedTimestamp!.getTime() : maxTimestamp;
                      dataByItems.push({
                        pointId: associatedItem.itemName,
                        timestamp: selectedTimestamp!.toISOString(),
                        data: {
                          value: this.parseOPCUAValue(associatedItem.itemName, historyValue.value),
                          quality: historyValue.statusCode.name
                        }
                      });
                    }
                  }

                  return {
                    ...node,
                    continuationPoint: result.continuationPoint,
                    status: result.statusCode,
                    hasData: result.historyData && result.historyData.dataValues && result.historyData.dataValues.length > 0
                  };
                })
                .filter(
                  node => node.hasData && node.status === StatusCodes.Good && node.continuationPoint && node.continuationPoint.length > 0
                );

              this.logger.debug(`Adding ${dataByItems.length} values between ${startTime} and ${endTime}`);
              if (!testingItem) {
                await this.addContent({ type: 'time-values', content: dataByItems.filter(parsedData => parsedData.data.value) });
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

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const response = await session.performMessageTransaction(
            this.getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead)
          );

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
      if (testingItem) {
        return { type: 'time-values', content: dataByItems.filter(parsedData => parsedData.data.value) };
      }
      return maxTimestamp ? DateTime.fromMillis(maxTimestamp).toUTC().toISO() : null;
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;

    if (this.subscription) {
      await this.subscription.terminate();
      this.subscription = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    await super.disconnect();
    this.disconnecting = false;
  }

  async createSessionConfigs(
    settings: SouthOPCUASettings,
    clientCertificateManager: OPCUACertificateManager,
    encryptionService: EncryptionService,
    clientName: string
  ) {
    const options: OPCUAClientOptions = {
      applicationName: 'OIBus',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: toOPCUASecurityMode(settings.securityMode),
      securityPolicy: toOPCUASecurityPolicy(settings.securityPolicy),
      endpointMustExist: false,
      keepSessionAlive: settings.keepSessionAlive,
      requestedSessionTimeout: settings.readTimeout,
      keepPendingSessionsOnDisconnect: false,
      clientName,
      clientCertificateManager
    };

    let userIdentity: UserIdentityInfo;
    switch (settings.authentication.type) {
      case 'basic':
        userIdentity = {
          type: UserTokenType.UserName,
          userName: settings.authentication.username!,
          password: await encryptionService.decryptText(settings.authentication.password!)
        };
        break;
      case 'cert':
        const certContent = await fs.readFile(path.resolve(settings.authentication.certFilePath!));
        const privateKeyContent = await fs.readFile(path.resolve(settings.authentication.keyFilePath!));
        userIdentity = {
          type: UserTokenType.Certificate,
          certificateData: certContent,
          privateKey: privateKeyContent.toString('utf8')
        };
        break;
      default:
        userIdentity = { type: UserTokenType.Anonymous };
    }

    return { options, userIdentity };
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
    // Try to get a session
    let session;
    try {
      session = await this.connection.getSession();
    } catch {
      this.logger.error('OPCUA session not set. The connector cannot read values');
      return;
    }

    const itemsToRead = items.filter(item => item.settings.mode === 'da');
    if (itemsToRead.length === 0) {
      return;
    }
    try {
      if (itemsToRead.length > 1) {
        this.logger.debug(
          `Read ${itemsToRead.length} nodes ` +
            `[${itemsToRead[0].settings.nodeId}...${itemsToRead[itemsToRead.length - 1].settings.nodeId}]`
        );
      } else {
        this.logger.debug(`Read node ${itemsToRead[0].settings.nodeId}`);
      }
      const content = await this.getDAValues(itemsToRead, session);
      await this.addContent(content);
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  async getDAValues(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>, session: ClientSession): Promise<OIBusContent> {
    try {
      const startRequest = DateTime.now().toMillis();
      const dataValues = await session.read(items.map(item => ({ nodeId: item.settings.nodeId })));
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(`Found ${dataValues.length} results for ${items.length} items (DA mode) in ${requestDuration} ms`);
      if (dataValues.length !== items.length) {
        this.logger.error(
          `Received ${dataValues.length} node results, requested ${items.length} nodes. Request done in ${requestDuration} ms`
        );
      }

      const defaultTimestamp = DateTime.now().toUTC().toISO();
      const values = dataValues.map((dataValue: DataValue, i) => {
        const selectedTimestamp = dataValue.sourceTimestamp ?? dataValue.serverTimestamp;
        return {
          pointId: items[i].name,
          timestamp: selectedTimestamp ? selectedTimestamp.toISOString() : defaultTimestamp,
          data: {
            value: this.parseOPCUAValue(items[i].name, dataValue.value),
            quality: dataValue.statusCode.name
          }
        };
      });
      return { type: 'time-values', content: values.filter(parsedValue => parsedValue.data.value) };
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    if (!items.length) {
      return;
    }

    // Try to get a session
    let session;
    try {
      session = await this.connection.getSession();
    } catch {
      this.logger.error('OPCUA client could not subscribe to items: session not set');
      return;
    }

    if (!this.subscription) {
      this.subscription = await session.createSubscription2({
        requestedPublishingInterval: 150,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 0,
        publishingEnabled: true,
        priority: 10
      });
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.FLUSH_MESSAGE_TIMEOUT);
    }

    for (const item of items) {
      const monitoredItem = await this.subscription.monitor(
        {
          nodeId: item.settings.nodeId,
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
          if (this.bufferedValues.length >= this.MAX_NUMBER_OF_MESSAGES) {
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
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.FLUSH_MESSAGE_TIMEOUT);
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

  async initOpcuaCertificateFolders(certFolder: string): Promise<void> {
    const opcuaBaseFolder = path.resolve(certFolder, 'opcua');
    await createFolder(path.join(opcuaBaseFolder, 'own'));
    await createFolder(path.join(opcuaBaseFolder, 'own/certs'));
    await createFolder(path.join(opcuaBaseFolder, 'own/private'));
    await createFolder(path.join(opcuaBaseFolder, 'rejected'));
    await createFolder(path.join(opcuaBaseFolder, 'trusted'));
    await createFolder(path.join(opcuaBaseFolder, 'trusted/certs'));
    await createFolder(path.join(opcuaBaseFolder, 'trusted/crl'));

    await createFolder(path.join(opcuaBaseFolder, 'issuers'));
    await createFolder(path.join(opcuaBaseFolder, 'issuers/certs')); // contains Trusted CA certificates
    await createFolder(path.join(opcuaBaseFolder, 'issuers/crl')); // contains CRL of revoked CA certificates

    await fs.copyFile(path.resolve(`./`, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME), `${opcuaBaseFolder}/own/private/private_key.pem`);
    await fs.copyFile(path.resolve(`./`, CERT_FOLDER, CERT_FILE_NAME), `${opcuaBaseFolder}/own/certs/client_certificate.pem`);
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
}
