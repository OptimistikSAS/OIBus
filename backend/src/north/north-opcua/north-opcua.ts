import NorthConnector from '../north-connector';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  AttributeIds,
  ClientSession,
  DataType,
  MessageSecurityMode,
  OPCUACertificateManager,
  OPCUAClient,
  resolveNodeId,
  StatusCodes,
  UserTokenType
} from 'node-opcua';
import { randomUUID } from 'crypto';
import { OIBusOPCUAValue } from '../../transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import { OIBusError } from '../../model/engine.model';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';
import type { ILogger } from '../../model/logger.model';

/**
 * Class NorthOPCUA - Write values in an OPCUA server
 */
export default class NorthOPCUA extends NorthConnector<NorthOPCUASettings> {
  private clientCertificateManager: OPCUACertificateManager | null = null;
  private disconnecting = false;
  client: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(connector: NorthConnectorEntity<NorthOPCUASettings>, logger: ILogger, cacheService: CacheService) {
    super(connector, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['opcua'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const tempCertFolder = `opcua-test-${randomUUID()}`;
    await initOPCUACertificateFolders(tempCertFolder);
    const clientCertificateManager = new OPCUACertificateManager({
      rootFolder: path.resolve(tempCertFolder, 'opcua'),
      automaticallyAcceptUnknownCertificate: true
    });
    clientCertificateManager.state = 2;
    this.clientCertificateManager = clientCertificateManager;

    const items: Array<{ key: string; value: string }> = [];
    let session;
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
    } finally {
      await fs.rm(path.resolve(tempCertFolder), { recursive: true, force: true });
      if (session) {
        await session.close();
        session = null;
      }
    }
    return { items };
  }

  override async start(): Promise<void> {
    await initOPCUACertificateFolders(this.getCacheFolder());
    if (!this.clientCertificateManager) {
      this.clientCertificateManager = new OPCUACertificateManager({
        rootFolder: path.resolve(this.getCacheFolder(), 'opcua'),
        automaticallyAcceptUnknownCertificate: true
      });
      // Set state to 2 (Initialized) to avoid openssl call
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
      await this.triggerReconnect();
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

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.clientCertificateManager!,
      undefined
    );
    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
    return await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
  }

  async handleContent(fileStream: ReadStream, _cacheMetadata: CacheMetadata): Promise<void> {
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusOPCUAValue>;
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

        // Read DataType
        const dataValue = await this.client.read({
          nodeId,
          attributeId: AttributeIds.DataType
        });

        // Extract and Validate Type
        if (!dataValue.value || !dataValue.value.value) {
          this.logger.error(`Could not read DataType for node ID "${nodeId}"`);
          continue;
        }

        // Handling Variant/DataType complexities might need casting, simplified here
        const dataType = dataValue.value.value.value as DataType;

        // Basic check if it's a valid enum value (might need stricter check depending on node-opcua version)
        if (!Object.values(DataType).includes(dataType)) {
          this.logger.error(`Invalid data type for node ID "${nodeId}"`);
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
          this.logger.trace(`Value "${value.value}" written successfully on node ID "${value.nodeId}"`);
        } else {
          this.logger.error(`Failed to write value "${value.value}" for node ID "${value.nodeId}": ${writeResult.name}`);
        }
      } catch (error: unknown) {
        const message = (error as Error).message;

        // Check for specific write errors
        if (message.includes('BadNodeId') || message.includes('BadAttributeId')) {
          this.logger.error(`Write error on node ID "${nodeId}": ${message}`);
          continue;
        }

        const oibusError = new OIBusError((error as Error).message, true);
        this.logger.error(`Unexpected OPCUA error: ${oibusError.message}`);
        await this.triggerReconnect();
        throw oibusError;
      }
    }
  }

  private async triggerReconnect(): Promise<void> {
    await this.disconnect();
    if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }
}
