import NorthConnector from '../north-connector';
import EncryptionService, { CERT_FILE_NAME, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME } from '../../service/encryption.service';
import pino from 'pino';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import path from 'node:path';
import { createFolder } from '../../service/utils';
import fs from 'node:fs/promises';
import { SouthOPCUASettingsSecurityMode, SouthOPCUASettingsSecurityPolicy } from '../../../shared/model/south-settings.model';
import {
  AttributeIds,
  ClientSession,
  DataType,
  OPCUACertificateManager,
  OPCUAClient,
  OPCUAClientOptions,
  UserIdentityInfo,
  UserTokenType
} from 'node-opcua';
import { randomUUID } from 'crypto';
import { OIBusOPCUAValue } from '../../service/transformers/oibus-time-values-to-opcua-transformer';

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

function toOPCUADataTypes(dataType: string) {
  switch (dataType) {
    case 'boolean':
      return DataType.Boolean;
    case 's-byte':
      return DataType.SByte;
    case 'byte':
      return DataType.Byte;
    case 'int16':
      return DataType.Int16;
    case 'uint16':
      return DataType.UInt16;
    case 'int32':
      return DataType.Int32;
    case 'uint32':
      return DataType.UInt32;
    case 'int64':
      return DataType.Int64;
    case 'uint64':
      return DataType.UInt64;
    case 'float':
      return DataType.Float;
    case 'double':
      return DataType.Double;
    case 'string':
      return DataType.String;
    case 'date-time':
      return DataType.DateTime;
    default:
      return null;
  }
}

/**
 * Class NorthOPCUA - Write values in an OPCUA server
 */
export default class NorthOPCUA extends NorthConnector<NorthOPCUASettings> {
  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: NorthConnectorEntity<NorthOPCUASettings>,
    encryptionService: EncryptionService,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, encryptionService, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
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

  override async connect(): Promise<void> {
    await this.createSession();
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

  async createSession(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      const clientName = this.connector.id;
      const { options, userIdentity } = await this.createSessionConfigs(
        this.connector.settings,
        this.clientCertificateManager!,
        this.encryptionService,
        clientName
      );

      this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
      this.client = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
      this.logger.info(`OPCUA ${this.connector.name} connected`);
      await super.connect();
    } catch (error) {
      this.logger.error(`Error while connecting to the OPCUA server. ${error}`);
      await this.disconnect();
      this.reconnectTimeout = setTimeout(this.createSession.bind(this), this.connector.settings.retryInterval);
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    await super.disconnect();
    this.disconnecting = false;
  }

  async createSessionConfigs(
    settings: NorthOPCUASettings,
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

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'opcua':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusOPCUAValue>);

      default:
        this.logger.debug(`File "${cacheMetadata.contentFile}" of type ${cacheMetadata.contentType} ignored`);
        return;
    }
  }

  private async handleValues(values: Array<OIBusOPCUAValue>) {
    if (!this.client) {
      this.logger.error('OPCUA session not set. The connector cannot write values');
      return;
    }

    for (const value of values) {
      const dataType = toOPCUADataTypes(value.dataType);
      if (!dataType) {
        this.logger.trace(`Data type ${value.dataType} unrecognized`);
        continue;
      }
      // Write the value to the node
      const writeResult = await this.client.write({
        nodeId: value.nodeId,
        attributeId: AttributeIds.Value,
        value: {
          value: {
            dataType: dataType, // DataType.Int32
            value: value.value
          }
        }
      });

      if (writeResult.isGood()) {
        this.logger.trace(`Value ${value.value} written successfully on nodeId ${value.nodeId}`);
      } else {
        this.logger.error(`Failed to write value ${value.value} on nodeId ${value.nodeId}: ${writeResult.name}`);
      }
    }
  }
}
