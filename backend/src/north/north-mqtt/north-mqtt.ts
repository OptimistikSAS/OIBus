import NorthConnector from '../north-connector';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import mqtt from 'mqtt';
import { IConnackPacket, QoS } from 'mqtt-packet';
import { OIBusMQTTValue } from '../../transformers/connector-types.model';
import type { ICacheService } from '../../model/cache.service.model';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { OIBusError } from '../../model/engine.model';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';
import type { ILogger } from '../../model/logger.model';

/**
 * Class NorthOPCUA - Write values in a MQTT broker
 */
export default class NorthMQTT extends NorthConnector<NorthMQTTSettings> {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(configuration: NorthConnectorEntity<NorthMQTTSettings>, logger: ILogger, cacheService: ICacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    const connack = await new Promise<IConnackPacket>((resolve, reject) => {
      const client = mqtt.connect(this.connector.settings.url, options);
      client.once('connect', (packet: IConnackPacket) => {
        client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
        resolve(packet);
      });
      client.once('error', (error: Error) => {
        client.end(true);
        reject(error);
      });
    });

    const items: Array<{ key: string; value: string }> = [];
    items.push({ key: 'SessionPresent', value: String(connack.sessionPresent) });
    if (connack.properties) {
      const p = connack.properties;
      if (p.maximumQoS !== undefined) items.push({ key: 'MaximumQoS', value: String(p.maximumQoS) });
      if (p.retainAvailable !== undefined) items.push({ key: 'RetainAvailable', value: String(p.retainAvailable) });
      if (p.wildcardSubscriptionAvailable !== undefined)
        items.push({ key: 'WildcardSubscriptions', value: String(p.wildcardSubscriptionAvailable) });
      if (p.sharedSubscriptionAvailable !== undefined)
        items.push({ key: 'SharedSubscriptions', value: String(p.sharedSubscriptionAvailable) });
      if (p.maximumPacketSize !== undefined) items.push({ key: 'MaxPacketSize', value: String(p.maximumPacketSize) });
      if (p.serverKeepAlive !== undefined) items.push({ key: 'ServerKeepAlive', value: `${p.serverKeepAlive}s` });
      if (p.topicAliasMaximum !== undefined) items.push({ key: 'TopicAliasMaximum', value: String(p.topicAliasMaximum) });
    }
    return { items };
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
