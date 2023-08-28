import {
  AggregateFunction,
  AttributeIds,
  ClientMonitoredItem,
  ClientSubscription,
  HistoryReadRequest,
  MessageSecurityMode,
  OPCUAClient,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType
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
import { QueriesHistory, QueriesLastPoint, QueriesSubscription } from '../south-interface';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import { createFolder } from '../../service/utils';
import { OPCUACertificateManager } from 'node-opcua-certificate-manager';

export const MAX_NUMBER_OF_NODE_TO_LOG = 10;

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements QueriesHistory, QueriesLastPoint, QueriesSubscription
{
  static type = manifest.id;

  private clientCertificateManager: OPCUACertificateManager | null = null;
  private session: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthOPCUASettings>,
    items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
  }

  override async start(): Promise<void> {
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
    await super.start();
  }

  override async connect(): Promise<void> {
    await this.session?.close(); // close the session if it already exists
    await this.connectToOpcuaServer();
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.url}"`);

    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await this.initOpcuaCertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: `${tempCertFolder}/opcua`,
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    this.logger.trace(`Created OPCUA HA temporary folder for certificates: ${tempCertFolder}`);

    let session;
    try {
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        clientCertificateManager,
        this.encryptionService,
        'OIBus Connector test'
      );
      session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      this.logger.info(`OPCUA HA connected on "${this.connector.settings.url}"`);
    } catch (error: any) {
      this.logger.error(`Error while connecting to the OPCUA HA server. ${error}`);
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
      throw new Error('Please check logs');
    } finally {
      await fs.rm(tempCertFolder, { recursive: true, force: true });
      this.logger.trace('OPCUA HA temporary folder deleted');

      if (session) {
        await session.close();
        session = null;
      }
    }
  }

  /**
   * Connect to OPCUA_HA server with retry.
   */
  async connectToOpcuaServer(): Promise<void> {
    try {
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        this.clientCertificateManager!,
        this.encryptionService,
        this.connector.id // the id of the connector
      );

      this.logger.debug(`Connecting to OPCUA_HA on ${this.connector.settings.url}`);
      this.session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      this.logger.info(`OPCUA_HA ${this.connector.name} connected`);
      await super.connect();
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA HA server. ${error}`);
      await this.disconnect();
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.connector.settings.retryInterval);
    }
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    try {
      let maxTimestamp = DateTime.fromISO(startTime).toMillis();

      if (!this.session) {
        this.logger.error('OPCUA session not set. The connector cannot read values');
        return startTime;
      }
      const itemsByAggregates = new Map<Aggregate, Map<Resampling | undefined, Array<{ nodeId: string; itemName: string }>>>();
      items
        .filter(item => item.settings.mode === 'HA')
        .forEach(item => {
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

            // @ts-ignore
            const response = await this.session.performMessageTransaction(request);
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
              this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
            }

            if (response.results) {
              this.logger.debug(`Received a response of ${response.results.length} nodes`);
              let dataByItems: Array<any> = [];

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
                      ...result.historyData.dataValues.map((dataValue: any) => {
                        const selectedTimestamp = dataValue.sourceTimestamp ?? dataValue.serverTimestamp;
                        const selectedTime = selectedTimestamp.getTime();
                        maxTimestamp = selectedTime > maxTimestamp ? selectedTime : maxTimestamp;
                        return {
                          pointId: associatedItem.itemName,
                          timestamp: selectedTimestamp.toISOString(),
                          data: {
                            value: dataValue.value.value,
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
              await this.addValues(dataByItems);

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
          const response = await this.session.performMessageTransaction(
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
      if (!this.disconnecting) {
        await this.disconnect();
        await this.connect();
      }
      throw error;
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    await this.subscription?.terminate();
    this.subscription = null;

    await this.session?.close();
    this.session = null;

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
          returnBounds: false
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
    if (!this.session) {
      this.logger.error('OPCUA session not set. The connector cannot read values');
      return;
    }
    const itemsToRead = items.filter(item => item.settings.mode === 'DA');
    if (itemsToRead.length === 0) {
      return;
    }
    try {
      if (itemsToRead.length > 1) {
        this.logger.debug(`Read ${items.length} nodes ` + `[${items[0].settings.nodeId}...${items[items.length - 1].settings.nodeId}]`);
      } else {
        this.logger.debug(`Read node ${items[0].settings.nodeId}`);
      }

      const dataValues = await this.session.read(items.map(item => ({ nodeId: item.settings.nodeId })));
      if (!dataValues) {
        this.logger.error(`Could not read nodes`);
        return;
      }
      if (dataValues.length !== items.length) {
        this.logger.error(`Received ${dataValues.length} node results, requested ${items.length} nodes`);
      }

      const timestamp = new Date().toISOString();
      const values = dataValues.map((dataValue, i) => ({
        pointId: items[i].name,
        timestamp,
        data: {
          value: dataValue.value.value,
          quality: JSON.stringify(dataValue.statusCode)
        }
      }));
      await this.addValues(values);
    } catch (error) {
      if (!this.disconnecting) {
        await this.disconnect();
        await this.connect();
      }
      throw error;
    }
  }

  async subscribe(items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>>): Promise<void> {
    if (!items.length) {
      return;
    }
    if (!this.session) {
      this.logger.error('OPCUA client could not subscribe to items: session not set');
      return;
    }
    if (!this.subscription) {
      this.subscription = ClientSubscription.create(this.session, {
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
      monitoredItem.on('changed', async dataValue => {
        await this.addValues([
          {
            pointId: item.name,
            timestamp: DateTime.now().toUTC().toISO(),
            data: {
              value: dataValue.value.value,
              quality: JSON.stringify(dataValue.statusCode)
            }
          }
        ]);
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
}
