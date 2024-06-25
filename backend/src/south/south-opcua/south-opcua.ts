import {
  AggregateFunction,
  AttributeIds,
  ClientMonitoredItem,
  ClientSubscription,
  DataType,
  DataValue,
  HistoryReadRequest,
  MessageSecurityMode,
  OPCUAClient,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType,
  Variant
} from 'node-opcua-client';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { Aggregate, Instant, Resampling } from '../../../../shared/model/types';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import EncryptionService, { CERT_FILE_NAME, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME } from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { ClientSession } from 'node-opcua-client/source/client_session';
import { UserIdentityInfo } from 'node-opcua-client/source/user_identity_info';
import { OPCUAClientOptions } from 'node-opcua-client/source/opcua_client';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QueriesHistory, QueriesLastPoint, QueriesSubscription, DelegatesConnection } from '../south-interface';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import { createFolder } from '../../service/utils';
import { OPCUACertificateManager } from 'node-opcua-certificate-manager';
import { OIBusContent, OIBusTimeValue } from '../../../../shared/model/engine.model';
import ConnectionService, { ManagedConnection, ManagedConnectionSettings } from '../../service/connection.service';

export const MAX_NUMBER_OF_NODE_TO_LOG = 10;
export const NUM_VALUES_PER_NODE = 1000;

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements QueriesHistory, QueriesLastPoint, QueriesSubscription, DelegatesConnection<ClientSession>
{
  static type = manifest.id;

  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  connectionSettings: ManagedConnectionSettings<ClientSession>;
  connection!: ManagedConnection<ClientSession>;

  constructor(
    connector: SouthConnectorDTO<SouthOPCUASettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    connectionService: ConnectionService
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder, connectionService);

    this.connectionSettings = {
      closeFnName: 'close',
      sharedConnection: connector.sharedConnection ?? false
    };
  }

  override async start(dataStream = true): Promise<void> {
    await this.initOpcuaCertificateFolders(this.baseFolder);
    if (!this.clientCertificateManager) {
      this.clientCertificateManager = new OPCUACertificateManager({
        rootFolder: `${this.baseFolder}/opcua`,
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
      rootFolder: `${tempCertFolder}/opcua`,
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
    } catch (error: any) {
      const message = error.message;

      if (/BadTcpEndpointUrlInvalid/i.test(message)) {
        throw new Error('Please check the URL');
      }

      // Security policy
      if (/Cannot find an Endpoint matching {1,2}security mode/i.test(message) && this.connector.settings.securityPolicy) {
        throw new Error(`Security Policy "${this.connector.settings.securityPolicy}" is not supported on the server`);
      }
      if (/The connection may have been rejected by server/i.test(message) && this.connector.settings.securityPolicy !== 'None') {
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
      if (error.code === 'ENOENT' && this.connector.settings.authentication.type === 'cert') {
        throw new Error(`File "${error.path}" does not exist`);
      }
      if (/Failed to read private key/i.test(message)) {
        const keyPath = path.resolve(this.connector.settings.authentication.keyFilePath!);
        throw new Error(`Could not read private key "${keyPath}"`);
      }

      // Unhandled errors
      throw new Error(error.message);
    } finally {
      await fs.rm(tempCertFolder, { recursive: true, force: true });

      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>> {
    return items.filter(item => item.settings.mode === 'HA');
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
    items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    startTimeFromCache: Instant
  ): Promise<Instant> {
    // Try to get a session
    let session;
    try {
      session = await this.connection.getSession();
    } catch (error) {
      this.logger.error('OPCUA session not set. The connector cannot read values');
      return startTime;
    }

    try {
      let maxTimestamp = DateTime.fromISO(startTimeFromCache).toMillis();
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

      for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
        for (const [resampling, resampledItems] of aggregatedItems.entries()) {
          const logs: Map<string, { description: string; affectedNodes: Array<string> }> = new Map();

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

            // @ts-ignore
            const response = await session.performMessageTransaction(request);
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
              this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
            }

            if (response.results) {
              this.logger.debug(`Received a response of ${response.results.length} nodes`);
              let dataByItems: Array<OIBusTimeValue> = [];

              nodesToRead = nodesToRead
                .map((node, i) => {
                  const result = response.results[i];
                  const associatedItem = resampledItems.find(item => item.nodeId === node.nodeId)!;

                  if (result.historyData?.dataValues) {
                    this.logger.trace(
                      `Result for node "${node.nodeId}" (number ${i}) contains ` +
                        `${result.historyData.dataValues.length} values and has status code ` +
                        `${JSON.stringify(result.statusCode.value)}, continuation point is ${result.continuationPoint}`
                    );
                    dataByItems = [
                      ...dataByItems,
                      ...result.historyData.dataValues.map((dataValue: DataValue) => {
                        const selectedTimestamp = dataValue.sourceTimestamp ?? dataValue.serverTimestamp;
                        const selectedTime = selectedTimestamp!.getTime();
                        maxTimestamp = selectedTime > maxTimestamp ? selectedTime : maxTimestamp;
                        return {
                          pointId: associatedItem.itemName,
                          timestamp: selectedTimestamp!.toISOString(),
                          data: {
                            value: this.parseOPCUAValue(associatedItem.itemName, dataValue.value),
                            quality: JSON.stringify(dataValue.statusCode)
                          }
                        };
                      })
                    ];
                  }
                  // Reason of statusCode not equal to zero could be there is no data for the requested data and interval
                  if (result.statusCode.value !== StatusCodes.Good) {
                    if (!logs.has(result.statusCode.value)) {
                      logs.set(result.statusCode.value, {
                        description: result.statusCode.description,
                        affectedNodes: [associatedItem.itemName]
                      });
                    } else {
                      logs.get(result.statusCode.value)!.affectedNodes.push(associatedItem.itemName);
                    }
                  }

                  return {
                    ...node,
                    continuationPoint: result.continuationPoint
                  };
                })
                .filter(node => !!node.continuationPoint);

              this.logger.debug(`Adding ${dataByItems.length} values between ${startTime} and ${endTime}`);
              await this.addContent({ type: 'time-values', content: dataByItems.filter(parsedData => parsedData.data.value) });

              this.logger.trace(`Continue read for ${nodesToRead.length} points`);
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

          // @ts-ignore
          const response = await session.performMessageTransaction(
            this.getHistoryReadRequest(startTime, endTime, aggregate, resampling, nodesToRead)
          );

          if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
            this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
          }
          for (const [statusCode, log] of logs.entries()) {
            if (log.affectedNodes.length > MAX_NUMBER_OF_NODE_TO_LOG) {
              this.logger.debug(
                `${log.description} with status code ${statusCode}: [${log.affectedNodes[0]}..${
                  log.affectedNodes[log.affectedNodes.length - 1]
                }]`
              );
            } else {
              this.logger.debug(`${log.description} with status code ${statusCode}: [${log.affectedNodes.toString()}]`);
            }
          }
        }
      }
      return DateTime.fromMillis(maxTimestamp).toUTC().toISO() as Instant;
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

    await this.subscription?.terminate();
    this.subscription = null;

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
      securityMode: MessageSecurityMode[settings.securityMode],
      securityPolicy: settings.securityPolicy || undefined,
      endpointMustExist: false,
      keepSessionAlive: settings.keepSessionAlive,
      requestedSessionTimeout: settings.readTimeout,
      keepPendingSessionsOnDisconnect: false,
      clientName,
      // @ts-ignore
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

  async lastPointQuery(items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>): Promise<void> {
    // Try to get a session
    let session;
    try {
      session = await this.connection.getSession();
    } catch (error) {
      this.logger.error('OPCUA session not set. The connector cannot read values');
      return;
    }

    const itemsToRead = items.filter(item => item.settings.mode === 'DA');
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

      const startRequest = DateTime.now().toMillis();
      const dataValues = await session.read(itemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(`Found ${dataValues.length} results for ${itemsToRead.length} items (DA mode) in ${requestDuration} ms`);
      if (dataValues.length !== itemsToRead.length) {
        this.logger.error(
          `Received ${dataValues.length} node results, requested ${itemsToRead.length} nodes. Request done in ${requestDuration} ms`
        );
      }

      const timestamp = DateTime.now().toUTC().toISO()!;
      const values = dataValues.map((dataValue: DataValue, i) => ({
        pointId: itemsToRead[i].name,
        timestamp,
        data: {
          value: this.parseOPCUAValue(itemsToRead[i].name, dataValue.value),
          quality: JSON.stringify(dataValue.statusCode)
        }
      }));
      await this.addContent({ type: 'time-values', content: values.filter(parsedValue => parsedValue.data.value) });
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  async subscribe(items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>): Promise<void> {
    if (!items.length) {
      return;
    }

    // Try to get a session
    let session;
    try {
      session = await this.connection.getSession();
    } catch (error) {
      this.logger.error('OPCUA client could not subscribe to items: session not set');
      return;
    }

    if (!this.subscription) {
      this.subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: 150,
        requestedLifetimeCount: 10 * 60 * 10,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 2,
        publishingEnabled: true,
        priority: 6
      });
    }

    items.forEach(item => {
      const monitoredItem = ClientMonitoredItem.create(
        this.subscription!,
        {
          nodeId: item.settings.nodeId,
          attributeId: AttributeIds.Value
        },
        {
          samplingInterval: 2,
          discardOldest: true,
          queueSize: 1
        },
        TimestampsToReturn.Neither
      );
      monitoredItem.on('changed', async (dataValue: DataValue) => {
        const parsedValue = this.parseOPCUAValue(item.name, dataValue.value);
        if (parsedValue) {
          await this.addContent({
            type: 'time-values',
            content: [
              {
                pointId: item.name,
                timestamp: DateTime.now().toUTC().toISO()!,
                data: {
                  value: parsedValue,
                  quality: JSON.stringify(dataValue.statusCode)
                }
              }
            ]
          });
        }
      });
      this.monitoredItems.set(item.id, monitoredItem);
    });
  }

  async unsubscribe(items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>): Promise<void> {
    for (const item of items) {
      if (this.monitoredItems.has(item.id)) {
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
        return Buffer.from(opcuaVariant.value).readUInt8().toString();

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
        this.logger.warn(`Item ${itemName} with value ${opcuaVariant.value} of type ${opcuaVariant.dataType} could not be parsed`);
        return '';
    }
  }
}
