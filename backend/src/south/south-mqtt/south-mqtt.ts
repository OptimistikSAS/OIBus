import mqtt from 'mqtt';
import { QoS } from 'mqtt-packet';
import SouthConnector from '../south-connector';

import pino from 'pino';
import { DateTime } from 'luxon';
import { Instant } from '../../../shared/model/types';
import { QueriesSubscription, SharableConnection } from '../south-interface';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import MqttClient, { ISubscriptionMap } from 'mqtt/lib/client';
import { connectionService } from '../../service/connection.service';
import { createConnectionOptions, createContent, parseMessage } from '../../service/utils-mqtt';

/**
 * Class SouthMQTT - Subscribe to a data topic from a MQTT broker
 */
export default class SouthMQTT
  extends SouthConnector<SouthMQTTSettings, SouthMQTTItemSettings>
  implements QueriesSubscription, SharableConnection<MqttClient.MqttClient>
{
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedMessages: Array<{ topic: string; message: string }> = [];
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, engineAddContentCallback, southConnectorRepository, southCacheRepository, scanModeRepository, logger, baseFolders);
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
          this.logger.debug('MQTT Client closed unintentionally');
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
      this.client!.on('message', async (topic, message, packet) => {
        this.logger.trace(`MQTT message for topic ${topic}: ${message}, dup:${packet.dup}, qos:${packet.qos}, retain:${packet.retain}`);
        this.bufferedMessages.push({ topic, message: message.toString() });
        if (this.bufferedMessages.length >= this.connector.settings.maxNumberOfMessages) {
          await this.flushMessages();
        }
      });
      this.logger.info(`MQTT South connector ${this.connector.name} connected`);
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
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
        await this.addContent({
          type: 'time-values',
          content: messageToParse
            .map(element => {
              return parseMessage(element.topic, element.message, this.connector.items, this.logger);
            })
            .reduce((previousValue, element) => previousValue.concat(...element), [])
        });
      } catch (error: unknown) {
        this.logger.error(`Error when flushing messages: ${error}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
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
    await this.flushMessages();
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
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

  override async testItem(
    item: SouthConnectorItemEntity<SouthMQTTItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    let session: MqttClient.MqttClient;
    return new Promise<void>((resolve, reject) => {
      (async () => {
        try {
          session = await this.getSession();
          session.once('message', async (topic, message, _packet) => {
            try {
              const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
              await session.unsubscribeAsync(item.settings.topic);
              session.end(true);
              callback({
                type: 'time-values',
                content: createContent(item, message.toString(), messageTimestamp, this.logger)
              });
              resolve();
            } catch (error: unknown) {
              reject(`Error when testing item ${item.settings.topic} (received message "${message}"): ${(error as Error).message}`);
            }
          });
          await session.subscribeAsync(item.settings.topic);
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
      this.logger.error('MQTT client could not subscribe to items: client not set');
      return;
    }

    try {
      const subscriptions: ISubscriptionMap = {};
      for (const item of items) {
        subscriptions[item.settings.topic] = { qos: parseInt(item.settings.qos) as QoS };
      }
      await this.client.subscribeAsync(subscriptions);
    } catch (error: unknown) {
      this.logger.error(`Subscription error: ${(error as Error).message}`);
    }
  }

  async unsubscribe(items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      this.logger.warn('MQTT client is not set. Nothing to unsubscribe');
      return;
    }
    try {
      await this.client.unsubscribeAsync(items.map(item => item.settings.topic));
    } catch (error: unknown) {
      this.logger.error(`Unsubscription error: ${(error as Error).message}`);
    }
  }

  getSharedConnectionSettings(): { connectorType: 'north' | 'south' | undefined; connectorId: string | undefined } {
    return {
      connectorType: this.connector.settings.sharedConnection?.connectorType,
      connectorId: this.connector.settings.sharedConnection?.connectorId
    };
  }
}
