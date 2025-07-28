import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
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
import path from 'node:path';
import { QoS } from 'mqtt-packet';
import { OIBusMQTTValue } from '../../service/transformers/connector-types.model';

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
    const options = await this.createConnectionOptions();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      await this.connectToBroker(options);
      await super.connect();
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
    }
  }

  async connectToBroker(options: mqtt.IClientOptions): Promise<void> {
    return new Promise(resolve => {
      this.logger.info(`Connecting to "${this.connector.settings.url}"`);
      this.client = mqtt.connect(this.connector.settings.url, options);

      this.client.once('connect', async () => {
        this.logger.info(`Connected to ${this.connector.settings.url}`);
        resolve();
      });
      this.client.once('error', async error => {
        await this.disconnect();
        this.logger.error(`MQTT Client error: ${error}`);
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        resolve(); // No need to reject, but need to resolve to not block thread
      });
      this.client.once('close', () => {
        if (this.disconnecting) {
          this.logger.debug('MQTT Client intentionally disconnected');
        } else {
          this.logger.debug(`MQTT Client closed unintentionally`);
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        }
      });
    });
  }

  override async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.disconnecting = true;
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}...`);
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<void> {
    const options = await this.createConnectionOptions();
    await this.testConnectionToBroker(options);
  }

  async testConnectionToBroker(options: mqtt.IClientOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.connector.settings.url, options);
      client.once('connect', () => {
        this.logger.info(`Connection test to "${this.connector.settings.url}" successful`);
        client.end(true);
        resolve();
      });
      client.once('error', error => {
        this.logger.error(`MQTT connection error. ${error}`);
        client.end(true);
        reject(`MQTT connection error. ${error}`);
      });
    });
  }

  async createConnectionOptions(): Promise<mqtt.IClientOptions> {
    const options: mqtt.IClientOptions = {
      rejectUnauthorized: this.connector.settings.rejectUnauthorized,
      reconnectPeriod: 0, // managed by OIBus
      connectTimeout: this.connector.settings.connectTimeout,
      clientId: this.connector.id,
      queueQoSZero: false
    };
    if (this.connector.settings.authentication.type === 'basic') {
      options.username = this.connector.settings.authentication.username;
      options.password = Buffer.from(await encryptionService.decryptText(this.connector.settings.authentication.password!)).toString();
    } else if (this.connector.settings.authentication.type === 'cert') {
      options.cert = this.connector.settings.authentication.certFilePath
        ? await fs.readFile(path.resolve(this.connector.settings.authentication.certFilePath))
        : '';
      options.key = this.connector.settings.authentication.keyFilePath
        ? await fs.readFile(path.resolve(this.connector.settings.authentication.keyFilePath))
        : '';
      options.ca = this.connector.settings.authentication.caFilePath
        ? await fs.readFile(path.resolve(this.connector.settings.authentication.caFilePath))
        : '';
    }
    if (this.connector.settings.qos === '1' || this.connector.settings.qos === '2') {
      options.clean = !this.connector.settings.persistent;
    }
    return options;
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
        await this.client.publishAsync(value.topic, value.payload, { qos: parseInt(this.connector.settings.qos) as QoS });
      } catch (error: unknown) {
        this.logger.error(`Unexpected error on topic ${value.topic}: ${(error as Error).message}`);
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        }
        throw error;
      }
    }
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }
}
