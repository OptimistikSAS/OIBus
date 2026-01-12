import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import mqtt from 'mqtt';
import fs from 'node:fs/promises';
import { QoS } from 'mqtt-packet';
import { OIBusMQTTValue } from '../../transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { OIBusError } from '../../model/engine.model';

/**
 * Class NorthOPCUA - Write values in a MQTT broker
 */
export default class NorthMQTT extends NorthConnector<NorthMQTTSettings> {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: NorthConnectorEntity<NorthMQTTSettings>,
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService
  ) {
    super(configuration, logger, cacheFolderPath, cacheService);
  }

  override async connect(): Promise<void> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.info(`Connecting to "${this.connector.settings.url}"`);
      this.client = await mqtt.connectAsync(this.connector.settings.url, options);
      this.client.once('error', async error => {
        await this.disconnect();
        this.logger.error(`MQTT Client error: ${error}`);
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
      });
      this.client.once('close', () => {
        if (this.disconnecting) {
          this.logger.debug('MQTT Client intentionally disconnected');
        } else {
          this.logger.debug(`MQTT Client closed unintentionally`);
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        }
      });
      this.logger.info(`MQTT North connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the MQTT broker: ${(error as Error).message}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
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
      this.client.removeAllListeners();
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}`);
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<void> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    const client = await mqtt.connectAsync(this.connector.settings.url, options);
    client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusMQTTValue>);
  }

  private async handleValues(values: Array<OIBusMQTTValue>) {
    for (const value of values) {
      try {
        if (!this.client) {
          throw new OIBusError('MQTT client not set. The connector cannot write values', true);
        }
        await this.client.publishAsync(value.topic, value.payload, { qos: parseInt(this.connector.settings.qos) as QoS });
      } catch (error: unknown) {
        const oibusError = new OIBusError((error as Error).message, true);
        this.logger.error(`Unexpected error: ${oibusError.message}`);
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        }
        throw oibusError;
      }
    }
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }
}
