import {
  HistoryReadRequest,
  MessageSecurityMode,
  OPCUAClient,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType
} from 'node-opcua-client';
import { OPCUACertificateManager } from 'node-opcua-certificate-manager';

import { SouthConnectorDTO, OibusItemDTO } from '../../../../shared/model/south-connector.model';
import { Instant } from '../../../../shared/model/types';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { initOpcuaCertificateFolders, MAX_NUMBER_OF_NODE_TO_LOG } from '../../service/opcua.service';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { ClientSession } from 'node-opcua-client/source/client_session';
import { UserIdentityInfo } from 'node-opcua-client/source/user_identity_info';
import { OPCUAClientOptions } from 'node-opcua-client/source/opcua_client';
import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';

const AGGREGATE_TYPES = ['raw', 'count', 'max', 'min', 'avg'];
type AggregateType = typeof AGGREGATE_TYPES[number];

const RESAMPLINGS = ['none', '1s', '10s', '30s', '60s', '1h', '24h'];
type Resampling = typeof RESAMPLINGS[number];

/**
 * Class SouthOPCUAHA - Connect to an OPCUA server in HA (Historian Access) mode
 */
export default class SouthOPCUAHA extends SouthConnector {
  static category = manifest.category;

  private clientCertificateManager: OPCUACertificateManager | null = null;
  private session: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode,
      manifest
    );
  }

  override async start(): Promise<void> {
    await initOpcuaCertificateFolders(this.baseFolder);
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

  /**
   * Connect to OPCUA_HA server with retry.
   */
  async connectToOpcuaServer(): Promise<void> {
    try {
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1
      };
      const options: OPCUAClientOptions = {
        applicationName: 'OIBus',
        connectionStrategy,
        securityMode: MessageSecurityMode[this.configuration.settings.securityMode],
        securityPolicy: this.configuration.settings.securityPolicy,
        endpointMustExist: false,
        keepSessionAlive: this.configuration.settings.keepSessionAlive,
        keepPendingSessionsOnDisconnect: false,
        clientName: this.configuration.id, // the id of the connector
        clientCertificateManager: this.clientCertificateManager!
      };

      let userIdentity: UserIdentityInfo;
      switch (this.configuration.settings.authentication.type) {
        case 'basic':
          userIdentity = {
            type: UserTokenType.UserName,
            userName: this.configuration.settings.authentication.username,
            password: await this.encryptionService.decryptText(this.configuration.settings.authentication.password)
          };
          break;
        case 'cert':
          const certContent = await fs.readFile(path.resolve(this.configuration.settings.authentication.certPath));
          const privateKeyContent = await fs.readFile(path.resolve(this.configuration.settings.authentication.keyPath));
          userIdentity = {
            type: UserTokenType.Certificate,
            certificateData: certContent,
            privateKey: privateKeyContent.toString('utf8')
          };
          break;
        default:
          userIdentity = { type: UserTokenType.Anonymous };
      }
      this.session = await OPCUAClient.createSession(this.configuration.settings.url, userIdentity, options);
      this.logger.info(`OPCUA_HA ${this.configuration.name} connected`);
      await super.connect();
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA HA server: ${error}`);
      await this.internalDisconnect();
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.configuration.settings.retryInterval);
    }
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   */
  override async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    try {
      let maxTimestamp = DateTime.fromISO(startTime).toMillis();

      const itemsByAggregates = new Map<AggregateType, Map<Resampling, Array<{ nodeId: string; itemName: string }>>>();
      items.forEach(item => {
        if (!itemsByAggregates.has(item.settings.aggregate)) {
          itemsByAggregates.set(item.settings.aggregate, new Map<Resampling, Array<{ nodeId: string; itemName: string }>>());
        }
        if (!itemsByAggregates.get(item.settings.aggregate)!.has(item.settings.resampling)) {
          itemsByAggregates
            .get(item.settings.aggregate)!
            .set(item.settings.resampling, [{ itemName: item.name, nodeId: item.settings.nodeId }]);
        } else {
          const currentList = itemsByAggregates.get(item.settings.aggregate)!.get(item.settings.resampling)!;
          currentList.push({ itemName: item.name, nodeId: item.settings.nodeId });
          itemsByAggregates.get(item.settings.aggregate)!.set(item.settings.resampling, currentList);
        }
      });

      const dataByItems: Array<any> = [];
      for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
        for (const [resampling, resampledItems] of aggregatedItems.entries()) {
          const logs: Map<string, { description: string; affectedNodes: Array<string> }> = new Map();

          let nodesToRead = resampledItems.map(item => ({
            continuationPoint: undefined,
            dataEncoding: undefined,
            indexRange: undefined,
            nodeId: item.nodeId
          }));

          this.logger.trace(`Reading ${resampledItems.length} items with aggregate ${aggregate} and resampling ${resampling}`);
          let historyReadDetails: ReadRawModifiedDetails;
          do {
            switch (aggregate) {
              case 'raw':
              default:
                historyReadDetails = new ReadRawModifiedDetails({
                  // @ts-ignore
                  startTime,
                  // @ts-ignore
                  endTime,
                  // numValuesPerNode: options.numValuesPerNode,
                  isReadModified: false,
                  returnBounds: false
                });
            }

            const request = new HistoryReadRequest({
              historyReadDetails,
              nodesToRead,
              releaseContinuationPoints: false,
              timestampsToReturn: TimestampsToReturn.Both
            });
            // if (options.timeout) request.requestHeader.timeoutHint = options.timeout
            // @ts-ignore
            const response = await this.session?.performMessageTransaction(request);
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
              this.logger.error(`Error while reading history: ${response.responseHeader.serviceResult.description}`);
            }

            if (response.results) {
              const startTimeMs = DateTime.fromISO(startTime).toMillis();
              this.logger.debug(`Received a response of ${response.results.length} nodes.`);
              nodesToRead = nodesToRead
                .map((node, i) => {
                  const result = response.results[i];
                  const associatedItem = resampledItems.find(item => item.nodeId === node.nodeId);
                  if (associatedItem) {
                    if (result.historyData?.dataValues) {
                      this.logger.trace(
                        `Result for node "${node.nodeId}" (number ${i}) contains ` +
                          `${result.historyData.dataValues.length} values and has status code ` +
                          `${JSON.stringify(result.statusCode.value)}, continuation point is ${result.continuationPoint}`
                      );
                      dataByItems.push(
                        ...result.historyData.dataValues
                          .filter((dataValue: any) => {
                            // It seems that node-opcua doesn't take into account the millisecond part when requesting historical data
                            // Reading from 1583914010001 returns values with timestamp 1583914010000
                            // Filter out values with timestamp smaller than startTime
                            const selectedTimestamp = dataValue.sourceTimestamp ?? dataValue.serverTimestamp;
                            return selectedTimestamp.getTime() >= startTimeMs;
                          })
                          .map((dataValue: any) => {
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
                      );
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
                  } else {
                    this.logger.error(`Node "${node.nodeId}" not found in items for aggregate ${aggregate} and resampling ${resampling}`);
                  }

                  return {
                    ...node,
                    continuationPoint: result.continuationPoint
                  };
                })
                .filter(node => !!node.continuationPoint);
              this.logger.trace(`Continue read for ${nodesToRead.length} points.`);
            } else {
              this.logger.error('No result found in response.');
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
          const response = await this.session?.performMessageTransaction(
            new HistoryReadRequest({
              historyReadDetails,
              nodesToRead,
              releaseContinuationPoints: true,
              timestampsToReturn: TimestampsToReturn.Both
            })
          );

          if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
            this.logger.error(`Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
          }
          for (const [statusCode, log] of logs.entries()) {
            switch (statusCode) {
              default:
                if (log.affectedNodes.length > MAX_NUMBER_OF_NODE_TO_LOG) {
                  this.logger.debug(
                    `${log.description} with status code ${statusCode}: [${log.affectedNodes[0]}..${
                      log.affectedNodes[log.affectedNodes.length - 1]
                    }]`
                  );
                } else {
                  this.logger.debug(`${log.description} with status code ${statusCode}: [${log.affectedNodes.toString()}]`);
                }
                break;
            }
          }
        }
      }
      this.logger.debug(`Adding ${dataByItems.length} values between ${startTime} and ${endTime}`);
      await this.addValues(dataByItems);
      return DateTime.fromMillis(maxTimestamp).toUTC().toISO();
    } catch (error) {
      if (!this.disconnecting) {
        await this.internalDisconnect();
        await this.connect();
      }
      throw error;
    }
  }

  async internalDisconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    await this.session?.close();
    this.session = null;

    await super.disconnect();
    this.disconnecting = false;
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    await this.internalDisconnect();
  }
}
