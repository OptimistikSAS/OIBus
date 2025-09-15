import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import path from 'node:path';
import fs from 'node:fs/promises';
import { AttributeIds, ClientSession, DataType, OPCUACertificateManager, OPCUAClient, resolveNodeId } from 'node-opcua';
import { randomUUID } from 'crypto';
import { OIBusOPCUAValue } from '../../service/transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import { OIBusError } from '../../model/engine.model';

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
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService
  ) {
    super(connector, logger, cacheFolderPath, cacheService);
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
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.client = await this.createSession();
      this.logger.info(`OPCUA North connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the OPCUA server: ${(error as Error).message}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
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

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.clientCertificateManager!,
      undefined
    );
    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
    const session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
    this.logger.info(`OPCUA connector "${this.connector.name}" connected`);
    return session;
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusOPCUAValue>);
  }

  private async handleValues(values: Array<OIBusOPCUAValue>) {
    for (const value of values) {
      let nodeId;
      try {
        if (!this.client) {
          throw new OIBusError('OPCUA client not set. The connector cannot write values', true);
        }

        try {
          nodeId = resolveNodeId(value.nodeId);
        } catch (error: unknown) {
          this.logger.error(`Error when parsing node ID ${value.nodeId}: ${(error as Error).message}`);
          continue;
        }

        // Read the DataType attribute of the node
        const dataValue = await this.client.read({
          nodeId,
          attributeId: AttributeIds.DataType
        });
        // Extract the data type from the DataValue
        const dataType = dataValue.value.value.value as DataType;
        // Ensure that the dataType is valid
        if (!Object.values(DataType).includes(dataType)) {
          this.logger.error(`Invalid data type for node ID ${nodeId}`);
          continue;
        }
        // Write the value to the node
        const writeResult = await this.client.write({
          nodeId,
          attributeId: AttributeIds.Value,
          value: {
            value: {
              dataType,
              value: value.value
            }
          }
        });

        if (writeResult.isGood()) {
          this.logger.trace(`Value ${value.value} written successfully on nodeId ${value.nodeId}`);
        } else {
          this.logger.error(`Failed to write value ${value.value} on nodeId ${value.nodeId}: ${writeResult.name}`);
        }
      } catch (error: unknown) {
        // Check for specific write errors
        if ((error as Error).message.includes('BadNodeIdUnknown') || (error as Error).message.includes('BadAttributeIdInvalid')) {
          this.logger.error(`Write error on nodeId ${nodeId}: ${(error as Error).message}`);
          // Continue to the next iteration or operation
        } else {
          const oibusError = new OIBusError((error as Error).message, true);
          this.logger.error(`Unexpected error: ${oibusError.message}`);
          await this.disconnect();
          if (!this.disconnecting && this.connector.enabled) {
            this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
          }
          throw oibusError;
        }
      }
    }
  }

  supportedTypes(): Array<string> {
    return ['opcua'];
  }
}
