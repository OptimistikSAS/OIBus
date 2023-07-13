import { MessageSecurityMode, OPCUAClient, UserTokenType } from 'node-opcua-client';
import { OPCUACertificateManager } from 'node-opcua-certificate-manager';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { initOpcuaCertificateFolders } from '../../service/opcua.service';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { ClientSession } from 'node-opcua-client/source/client_session';
import { OPCUAClientOptions } from 'node-opcua-client/source/opcua_client';
import { UserIdentityInfo } from 'node-opcua-client/source/user_identity_info';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QueriesLastPoint, TestsConnection } from '../south-interface';
import { SouthOPCUADAItemSettings, SouthOPCUADASettings } from '../../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';

/**
 * Class SouthOPCUADA - Connect to an OPCUA server in DA (Data Access) mode
 */
export default class SouthOPCUADA
  extends SouthConnector<SouthOPCUADASettings, SouthOPCUADAItemSettings>
  implements QueriesLastPoint, TestsConnection
{
  static type = manifest.id;

  private clientCertificateManager: OPCUACertificateManager | null = null;
  private session: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorDTO<SouthOPCUADASettings>,
    items: Array<SouthConnectorItemDTO<SouthOPCUADAItemSettings>>,
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

  static async testConnection(settings: SouthOPCUADASettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    logger.trace(`Testing if OPCUA DA connection settings are correct`);

    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOpcuaCertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: `${tempCertFolder}/opcua`,
      automaticallyAcceptUnknownCertificate: true
    });
    // Set the state to the CertificateManager to 2 (Initialized) to avoid a call to openssl
    // It is useful for offline instances of OIBus where downloading openssl is not possible
    clientCertificateManager.state = 2;

    logger.trace(`Created OPCUA DA temporary folder for certificates: ${tempCertFolder}`);

    let session;
    try {
      const { options, userIdentity } = await SouthOPCUADA.createSessionConfigs(
        settings,
        clientCertificateManager,
        encryptionService,
        'OIBus Connector test'
      );
      logger.trace(`Connecting to OPCUA DA on ${settings.url}`);
      session = await OPCUAClient.createSession(settings.url, userIdentity, options);
      logger.info(`OPCUA DA connected`);
    } catch (error: any) {
      logger.error(`Error while connecting to the OPCUA DA server: ${error}`);
      const message = error.message;

      if (/BadTcpEndpointUrlInvalid/i.test(message)) {
        throw new Error('Please check the URL');
      }

      // Security policy
      if (/Cannot find an Endpoint matching {1,2}security mode/i.test(message) && settings.securityPolicy) {
        throw new Error(`Security Policy '${settings.securityPolicy}' is not supported on the server`);
      }
      if (/The connection may have been rejected by server/i.test(message) && settings.securityPolicy !== 'None') {
        throw new Error('Please check if the OIBus certificate has been trusted by the server');
      }

      // Authentication
      if (/BadIdentityTokenRejected/i.test(message)) {
        if (settings.authentication.type === 'basic') {
          throw new Error('Please check username and password');
        }

        if (settings.authentication.type === 'cert') {
          throw new Error('Please check the certificate and key');
        }
      }
      if (error.code === 'ENOENT' && settings.authentication.type === 'cert') {
        throw new Error(`File '${error.path}' does not exist`);
      }
      if (/Failed to read private key/i.test(message)) {
        const keyPath = path.resolve(settings.authentication.keyFilePath!);
        throw new Error(`Could not read private key '${keyPath}'`);
      }

      // Unhandled erros
      throw new Error('Please check logs');
    } finally {
      await fs.rm(tempCertFolder, { recursive: true, force: true });
      logger.trace('OPCUA DA temporary folder deleted');

      if (session) {
        await session.close();
        session = null;
      }

      logger.trace(`Closed connection to OPCUA DA on ${settings.url}`);
    }
  }

  /**
   * Connect to OPCUA_DA server with retry.
   */
  async connectToOpcuaServer(): Promise<void> {
    try {
      const { options, userIdentity } = await SouthOPCUADA.createSessionConfigs(
        this.connector.settings,
        this.clientCertificateManager!,
        this.encryptionService,
        this.connector.id // the id of the connector
      );
      this.logger.debug(`Connecting to OPCUA_DA on ${this.connector.settings.url}`);
      this.session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      this.logger.info(`OPCUA DA ${this.connector.name} connected`);
      await super.connect();
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA DA server. ${error}`);
      await this.internalDisconnect();
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.connector.settings.retryInterval);
    }
  }

  async lastPointQuery(items: Array<SouthConnectorItemDTO<SouthOPCUADAItemSettings>>): Promise<void> {
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

  static async createSessionConfigs(
    settings: SouthOPCUADASettings,
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
