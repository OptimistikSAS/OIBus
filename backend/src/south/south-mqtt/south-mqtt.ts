import mqtt from 'mqtt';
import { QoS } from 'mqtt-packet';
import SouthConnector from '../south-connector';

import pino from 'pino';
import { DateTime } from 'luxon';
import { Instant } from '../../../shared/model/types';
import { QueriesSubscription } from '../south-interface';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { createConnectionOptions, getItem } from '../../service/utils-mqtt';

/**
 * Class SouthMQTT - Subscribe to a data topic from a MQTT broker
 */
export default class SouthMQTT extends SouthConnector<SouthMQTTSettings, SouthMQTTItemSettings> implements QueriesSubscription {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedMessages: Array<{
    topic: string;
    message: string;
    item: SouthConnectorItemEntity<SouthMQTTItemSettings>;
    timestamp: Instant;
  }> = [];
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
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
      this.client.on('message', async (topic, message, packet) => {
        this.logger.trace(`MQTT message for topic ${topic}: ${message}, dup:${packet.dup}, qos:${packet.qos}, retain:${packet.retain}`);
        try {
          const item = getItem(topic, this.connector.items);
          this.bufferedMessages.push({ topic, message: message.toString(), item, timestamp: DateTime.now().toUTC().toISO() });
          if (this.bufferedMessages.length >= this.connector.settings.maxNumberOfMessages) {
            await this.flushMessages();
          }
        } catch (error: unknown) {
          this.logger.error(`Error for topic ${topic}: ${(error as Error).message}`);
          return;
        }
      });
      this.logger.info(`MQTT South connector "${this.connector.name}" connected`);
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the MQTT broker: ${(error as Error).message}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
      }
    }
  }

  async flushMessages(): Promise<void> {
    const messageToParse = Array.from(this.bufferedMessages);
    this.bufferedMessages = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (messageToParse.length) {
      this.logger.debug(`Flushing ${messageToParse.length} messages`);
      try {
        await this.addContent(
          {
            type: 'any-content',
            content: JSON.stringify(
              messageToParse.map(element => {
                return {
                  message: element.message,
                  timestamp: element.timestamp,
                  item: { id: element.item.id, name: element.item.name, topic: element.item.settings.topic }
                };
              })
            )
          },
          DateTime.now().toUTC().toISO(),
          [...new Set(messageToParse.map(element => element.item.id))]
        );
      } catch (error: unknown) {
        this.logger.error(`Error when flushing messages: ${(error as Error).message}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
      this.logger.info(`Disconnected from ${this.connector.settings.url}`);
      this.client = null;
    }
    await this.flushMessages();
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    const client = await mqtt.connectAsync(this.connector.settings.url, options);
    client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
    return { items: [{ key: 'Broker URL', value: this.connector.settings.url }] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthMQTTItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const options = await createConnectionOptions(this.connector.id, this.connector.settings, this.logger);
    return new Promise<OIBusContent>((resolve, reject) => {
      (async () => {
        try {
          const client = await mqtt.connectAsync(this.connector.settings.url, options);
          client.once('message', async (topic, message, _packet) => {
            try {
              const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
              await client.unsubscribeAsync(item.settings.topic);
              client.end(true);
              resolve({
                type: 'any-content',
                content: JSON.stringify({
                  message: message,
                  timestamp: messageTimestamp,
                  item: { id: item.id, name: item.name, topic: item.settings.topic }
                })
              });
            } catch (error: unknown) {
              reject(`Error when testing item ${item.settings.topic} (received message "${message}"): ${(error as Error).message}`);
            }
          });
          await client.subscribeAsync(item.settings.topic);
        } catch (error: unknown) {
          reject(`Error when testing item ${item.settings.topic}: ${(error as Error).message}`);
        }
      })().catch(reject); // Immediately invoke the async IIFE and catch any errors
    }).finally(async () => {
      await this.disconnect();
    });
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      // Inside the loop to manage client error events that end the client connection
      this.logger.error('MQTT client could not subscribe to items: client not set');
      return;
    }

    try {
      await this.client.subscribeAsync(
        items.map(item => item.settings.topic),
        { qos: parseInt(this.connector.settings.qos) as QoS }
      );
    } catch (error: unknown) {
      this.logger.error(`Subscription error: ${(error as Error).message}`);
    }
  }

  async unsubscribe(items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      // Inside the loop to manage client error events that end the client connection
      this.logger.warn('MQTT client is not set. Nothing to unsubscribe');
      return;
    }
    try {
      await this.client.unsubscribeAsync(items.map(item => item.settings.topic));
    } catch (error: unknown) {
      this.logger.error(`Unsubscription error: ${(error as Error).message}`);
    }
  }
}
