import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import mqtt from 'mqtt';
import fs from 'node:fs/promises';
import { OIBusMQTTValue } from '../../service/transformers/connector-types.model';
import MqttClient from 'mqtt/lib/client';
import { connectionService } from '../../service/connection.service';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { QoS } from 'mqtt-packet';

/**
 * Class NorthOPCUA - Write values in a MQTT broker
 */
export default class NorthMQTT extends NorthConnector<NorthMQTTSettings> {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: NorthConnectorEntity<NorthMQTTSettings>,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      await this.getSession();
      this.client!.once('error', async error => {
        await this.disconnect(error);
        this.logger.error(`MQTT Client error: ${error}`);
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      });
      this.client!.once('close', () => {
        if (this.disconnecting) {
          this.logger.debug('MQTT Client intentionally disconnected');
        } else {
          this.logger.debug(`MQTT Client closed unintentionally`);
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
      this.logger.info(`MQTT North connector ${this.connector.name} connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the MQTT broker: ${(error as Error).message}`);
      await this.disconnect(error as Error);
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async getSession(): Promise<MqttClient.MqttClient> {
    if (!this.client) {
      if (!this.connector.settings.sharedConnection) {
        this.client = await this.createSession();
      } else {
        this.client = await connectionService.getConnection<MqttClient.MqttClient>(
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
      this.client.removeAllListeners();
      this.client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
      this.logger.info(`Disconnected from ${this.connector.settings.connectionSettings!.url}...`);
    }
  }

  async createSession(): Promise<MqttClient.MqttClient> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings.connectionSettings!, this.logger);
    this.logger.info(`Connecting to "${this.connector.settings.connectionSettings!.url}"`);
    this.client = await mqtt.connectAsync(this.connector.settings.connectionSettings!.url, options);
    this.logger.info(`Connected to ${this.connector.settings.connectionSettings!.url}`);
    return this.client;
  }

  override async disconnect(error?: Error): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client && (!connectionService.isConnectionUsed('south', this.connector.id, this.connector.id) || error)) {
      if (!this.connector.settings.sharedConnection) {
        await this.closeSession();
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
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<void> {
    try {
      await this.getSession();
    } finally {
      await this.disconnect();
    }
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusMQTTValue>);
  }

  private async handleValues(values: Array<OIBusMQTTValue>) {
    if (!this.client) {
      throw new Error('MQTT client not set');
    }

    for (const value of values) {
      try {
        await this.client.publishAsync(value.topic, value.payload, { qos: parseInt(value.qos) as QoS });
      } catch (error: unknown) {
        this.logger.error(`Unexpected error on topic ${value.topic}: ${(error as Error).message}`);
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
        throw error;
      }
    }
  }

  getSharedConnectionSettings(): { connectorType: 'north' | 'south' | undefined; connectorId: string | undefined } {
    return {
      connectorType: this.connector.settings.sharedConnection?.connectorType,
      connectorId: this.connector.settings.sharedConnection?.connectorId
    };
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }
}
