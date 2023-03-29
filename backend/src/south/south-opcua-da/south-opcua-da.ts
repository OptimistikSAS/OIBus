import { MessageSecurityMode, OPCUAClient, UserTokenType } from 'node-opcua-client';
import { OPCUACertificateManager } from 'node-opcua-certificate-manager';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { initOpcuaCertificateFolders } from '../../service/opcua.service';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';

import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { ClientSession } from 'node-opcua-client/source/client_session';
import { OPCUAClientOptions } from 'node-opcua-client/source/opcua_client';
import { UserIdentityInfo } from 'node-opcua-client/source/user_identity_info';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Class SouthOPCUADA - Connect to an OPCUA server in DA (Data Access) mode
 */
export default class SouthOPCUADA extends SouthConnector {
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
   * Connect to OPCUA_DA server with retry.
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
      this.logger.debug(`Connecting to OPCUA_DA on ${this.configuration.settings.url}`);
      this.session = await OPCUAClient.createSession(this.configuration.settings.url, userIdentity, options);
      this.logger.info(`OPCUA DA ${this.configuration.name} connected`);
      await super.connect();
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA DA server. ${error}`);
      await this.internalDisconnect();
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.configuration.settings.retryInterval);
    }
  }

  override async lastPointQuery(items: Array<OibusItemDTO>): Promise<void> {
    try {
      if (items.length > 1) {
        this.logger.debug(`Read ${items.length} nodes ` + `[${items[0].settings.nodeId}...${items[items.length - 1].settings.nodeId}]`);
      } else {
        this.logger.debug(`Read node ${items[0].settings.nodeId}`);
      }

      const dataValues = await this.session?.read(items.map(item => ({ nodeId: item.settings.nodeId })));
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

  /*
  monitorPoints() {
    const nodesToMonitor = this.points
      .filter((point) => point.scanMode === 'listen')
      .map((point) => point.pointId)
    if (!nodesToMonitor.length) {
      this.logger.error('Monitoring ignored: no points to monitor')
      return
    }

    this.subscription = ClientSubscription.create(this.session, {
      requestedPublishingInterval: 150,
      requestedLifetimeCount: 10 * 60 * 10,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 2,
      publishingEnabled: true,
      priority: 6,
    })
    nodesToMonitor.forEach((nodeToMonitor) => {
      const monitoredItem = ClientMonitoredItem.create(
        this.subscription,
        {
          nodeId: nodeToMonitor,
          attributeId: AttributeIds.Value,
        },
        {
          samplingInterval: 2,
          discardOldest: true,
          queueSize: 1,
        },
        TimestampsToReturn.Neither,
      )

      monitoredItem.on('changed', (dataValue) => this.manageDataValues([dataValue], nodesToMonitor))
    })

    // On disconnect()
    if (this.subscription) {
      await this.subscription.terminate()
    }
  }
   */
}
