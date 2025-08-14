import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import path from 'node:path';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import fs from 'node:fs/promises';
import { AttributeIds, ClientSession, DataType, OPCUACertificateManager, OPCUAClient, resolveNodeId } from 'node-opcua';
import { randomUUID } from 'crypto';
import { OIBusOPCUAValue } from '../../service/transformers/connector-types.model';
import { SharableConnection } from '../../south/south-interface';
import { connectionService } from '../../service/connection.service';

/**
 * Class NorthOPCUA - Write values in an OPCUA server
 */
export default class NorthOPCUA extends NorthConnector<NorthOPCUASettings> implements SharableConnection<ClientSession> {
  private clientCertificateManager: OPCUACertificateManager | null = null;
  private client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: NorthConnectorEntity<NorthOPCUASettings>,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
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
      this.client = await this.getSession();
      this.logger.info(`OPCUA ${this.connector.name} connected`);
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
      undefined
    );

    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.connectionSettings!.url}`);
    return await OPCUAClient.createSession(this.connector.settings.connectionSettings!.url, userIdentity, options);
  }

  override async disconnect(error?: Error): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client && (!connectionService.isConnectionUsed('north', this.connector.id, this.connector.id) || error)) {
      if (!this.connector.settings.sharedConnection) {
        await this.client.close();
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
    await super.disconnect(error);
    this.disconnecting = false;
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    await this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusOPCUAValue>);
  }

  private async handleValues(values: Array<OIBusOPCUAValue>) {
    if (!this.client) {
      this.logger.error('OPCUA session not set. The connector cannot write values');
      return;
    }

    for (const value of values) {
      let nodeId;
      try {
        nodeId = resolveNodeId(value.nodeId);
      } catch (error: unknown) {
        this.logger.error(`Error when parsing node ID ${value.nodeId}: ${(error as Error).message}`);
        continue;
      }

      try {
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
          this.logger.error(`Unexpected error on nodeId ${nodeId}: ${(error as Error).message}`);
          await this.disconnect(error as Error);
          if (!this.disconnecting && this.connector.enabled) {
            this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
          }
          throw error;
        }
      }
    }
  }

  supportedTypes(): Array<string> {
    return ['opcua'];
  }
}
