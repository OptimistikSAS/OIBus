import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import mqtt from 'mqtt';
import { QoS } from 'mqtt-packet';
import { OIBusMQTTValue } from '../../transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { OIBusError } from '../../model/engine.model';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';

/**
 * Class NorthOPCUA - Write values in a MQTT broker
 */
export default class NorthMQTT extends NorthConnector<NorthMQTTSettings> {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(configuration: NorthConnectorEntity<NorthMQTTSettings>, logger: pino.Logger, cacheService: CacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }

  async testConnection(): Promise<void> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    const client = await mqtt.connectAsync(this.connector.settings.url, options);
    client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
      this.logger.info(`Connecting to "${this.connector.settings.url}"`);

      this.client = await mqtt.connectAsync(this.connector.settings.url, options);

      this.client.once('error', async error => {
        this.logger.error(`MQTT Client error: ${error.message}`);
        await this.triggerReconnect();
      });
      this.client.once('close', async () => {
        if (this.disconnecting) {
          this.logger.debug('MQTT Client intentionally disconnected');
        } else {
          this.logger.debug(`MQTT Client closed unintentionally`);
          await this.triggerReconnect();
        }
      });

      this.logger.info(`MQTT North connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the MQTT broker: ${(error as Error).message}`);
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
      this.client.removeAllListeners();
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}`);
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  async handleContent(fileStream: ReadStream, _cacheMetadata: CacheMetadata): Promise<void> {
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusMQTTValue>;
    for (const value of values) {
      try {
        if (!this.client) {
          throw new OIBusError('MQTT client not set. The connector cannot write values', true);
        }
        await this.client.publishAsync(value.topic, value.payload, { qos: parseInt(this.connector.settings.qos) as QoS });
      } catch (error: unknown) {
        const oibusError = new OIBusError((error as Error).message, true);
        this.logger.error(`MQTT Publish error: ${oibusError.message}`);
        await this.triggerReconnect();
        throw oibusError;
      }
    }
  }

  private async triggerReconnect(): Promise<void> {
    await this.disconnect();
    // Only schedule if not already disconnecting, enabled, and no timer already active
    if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
    }
  }
}
