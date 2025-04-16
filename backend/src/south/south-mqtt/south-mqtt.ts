import mqtt from 'mqtt';
import { QoS } from 'mqtt-packet';

import objectPath from 'object-path';
import SouthConnector from '../south-connector';
import EncryptionService from '../../service/encryption.service';

import pino from 'pino';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { Instant } from '../../../shared/model/types';
import { QueriesSubscription } from '../south-interface';
import {
  SouthMQTTItemSettings,
  SouthMQTTItemSettingsJsonPayloadTimestampPayload,
  SouthMQTTSettings
} from '../../../shared/model/south-settings.model';
import { convertDateTimeToInstant } from '../../service/utils';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthMQTT - Subscribe to data topic from a MQTT broker
 */
export default class SouthMQTT extends SouthConnector<SouthMQTTSettings, SouthMQTTItemSettings> implements QueriesSubscription {
  private client: mqtt.MqttClient | null = null;

  // TODO: add these as settings
  private MAX_NUMBER_OF_MESSAGES = 1000;
  private FLUSH_MESSAGE_TIMEOUT = 1000;

  private reconnectTimeout: NodeJS.Timeout | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private bufferedMessages: Array<{ topic: string; message: string }> = [];

  constructor(
    connector: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolders
    );
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
        this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.FLUSH_MESSAGE_TIMEOUT);
        resolve();
      });
      this.client.once('error', async error => {
        await this.disconnect();
        this.logger.error(`MQTT Client error: ${error}`);
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
        resolve(); // No need to reject, but need to resolve to not block thread
      });
      this.client.on('message', async (topic, message, packet) => {
        this.logger.trace(`MQTT message for topic ${topic}: ${message}, dup:${packet.dup}, qos:${packet.qos}, retain:${packet.retain}`);
        this.bufferedMessages.push({ topic, message: message.toString() });
        if (this.bufferedMessages.length >= this.MAX_NUMBER_OF_MESSAGES) {
          await this.flushMessages();
        }
      });
    });
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
              return this.parseMessage(element.topic, element.message);
            })
            .reduce((previousValue, element) => previousValue.concat(...element), [])
        });
      } catch (error: unknown) {
        this.logger.error(`Error when flushing messages: ${error}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.FLUSH_MESSAGE_TIMEOUT);
  }

  parseMessage(topic: string, message: string): Array<OIBusTimeValue> {
    const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
    try {
      const associatedItem = this.getItem(topic);
      return this.createContent(associatedItem, message, messageTimestamp);
    } catch (error) {
      this.logger.error(`Could not handle message "${message.toString()}" for topic "${topic}". ${error}`);
      return [];
    }
  }

  override async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
      this.logger.info(`Disconnected from ${this.connector.settings.url}...`);
      this.client = null;
    }
    await this.flushMessages();
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await super.disconnect();
  }

  override async testConnection(): Promise<void> {
    const options = await this.createConnectionOptions();
    options.clientId = `${options.clientId}-test`;
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

  override async testItem(
    item: SouthConnectorItemEntity<SouthMQTTItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const options = await this.createConnectionOptions();
    options.clientId = `${options.clientId}-test`;
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.connector.settings.url, options);
      client.once('connect', async () => {
        this.logger.info(`Connected to ${this.connector.settings.url}`);
        await client.subscribeAsync(item.settings.topic, { qos: parseInt(this.connector.settings.qos) as QoS });
      });
      client.once('error', async error => {
        client.end(true);
        reject(`MQTT connection error ${error}`);
      });
      client.once('message', async (topic, message, packet) => {
        this.logger.trace(`MQTT message for topic ${topic}: ${message}, dup:${packet.dup}`);
        const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
        await client.unsubscribeAsync(item.settings.topic);
        client.end(true);
        callback({
          type: 'time-values',
          content: this.createContent(item, message.toString(), messageTimestamp)
        });
        resolve();
      });
    });
  }

  async createConnectionOptions(): Promise<mqtt.IClientOptions> {
    const options: mqtt.IClientOptions = {
      reconnectPeriod: 0, // managed by OIBus
      connectTimeout: this.connector.settings.connectTimeout,
      rejectUnauthorized: this.connector.settings.rejectUnauthorized,
      queueQoSZero: false,
      log: this.mqttLog.bind(this),
      resubscribe: this.connector.settings.persistent || false,
      clientId: this.connector.id
    };
    if (this.connector.settings.authentication.type === 'basic') {
      options.username = this.connector.settings.authentication.username;
      options.password = Buffer.from(await this.encryptionService.decryptText(this.connector.settings.authentication.password!)).toString();
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

  private createContent(
    associatedItem: SouthConnectorItemEntity<SouthMQTTItemSettings>,
    message: string,
    messageTimestamp: Instant
  ): Array<OIBusTimeValue> {
    switch (associatedItem.settings.valueType) {
      case 'number':
        return [
          {
            pointId: associatedItem.name,
            timestamp: messageTimestamp,
            data: {
              value: message
            }
          }
        ];

      case 'string':
        return [
          {
            pointId: associatedItem.name,
            timestamp: messageTimestamp,
            data: {
              value: message
            }
          }
        ];

      case 'json':
        return this.formatValues(associatedItem, JSON.parse(message), messageTimestamp);
    }
  }

  formatValues(item: SouthConnectorItemEntity<SouthMQTTItemSettings>, data: object, messageTimestamp: Instant): Array<OIBusTimeValue> {
    if (item.settings.jsonPayload!.useArray) {
      const array = objectPath.get(data, item.settings.jsonPayload!.dataArrayPath!);
      if (!array || !Array.isArray(array)) {
        throw new Error(`Array not found for path ${item.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify(data)}`);
      }
      return array.map((element: Array<object>) => this.formatValue(item, element, messageTimestamp));
    }
    return [this.formatValue(item, data, messageTimestamp)];
  }

  formatValue(item: SouthConnectorItemEntity<SouthMQTTItemSettings>, data: object, messageTimestamp: Instant): OIBusTimeValue {
    const dataTimestamp =
      item.settings.jsonPayload!.timestampOrigin === 'oibus'
        ? messageTimestamp
        : this.getTimestamp(data, item.settings.jsonPayload!.timestampPayload!, messageTimestamp);

    const pointId =
      item.settings.jsonPayload!.pointIdOrigin === 'oibus'
        ? item.name
        : this.getPointId(data, item.settings.jsonPayload!.pointIdPath!, item.name);

    const dataValue: { value: string; [key: string]: string | number } = {
      value: objectPath.get(data, item.settings.jsonPayload!.valuePath)
    };

    for (const element of item.settings.jsonPayload!.otherFields!) {
      dataValue[element.name] = objectPath.get(data, element.path);
    }

    return {
      pointId: pointId,
      timestamp: dataTimestamp,
      data: {
        ...dataValue
      }
    };
  }

  getPointId(data: object, pointIdPath: string, itemName: string): string {
    const pointId = objectPath.get(data, pointIdPath!);
    if (!pointId) {
      this.logger.warn(`Point ID not found for path ${pointIdPath} in ${JSON.stringify(data)}. Using item name "${itemName}" instead`);
      return itemName;
    }
    return pointId;
  }

  getItem(topic: string): SouthConnectorItemEntity<SouthMQTTItemSettings> {
    const matchingItems = this.connector.items.filter(item => {
      const matchList = this.wildcardTopic(topic, item.settings.topic);
      // Count the number of wildcard. If it has the same number of wildcards in the item topic than the number of path chunk, it matches
      // If there is no wildcard, it should have empty arrays, so it is an exact match
      return !!(item.enabled && matchList && matchList.length === (item.settings.topic.match(/[+#]/g) || []).length);
    });

    if (matchingItems.length > 1) {
      throw new Error(
        `Topic "${topic}" should be subscribed only once but it has the following subscriptions: ${JSON.stringify(matchingItems)}`
      );
    } else if (matchingItems.length === 0) {
      throw new Error(`Item can't be determined from topic ${topic}`);
    }

    return matchingItems[0];
  }

  getTimestamp(data: object, formatOptions: SouthMQTTItemSettingsJsonPayloadTimestampPayload, messageTimestamp: Instant): string {
    const timestamp = objectPath.get(data, formatOptions.timestampPath!);
    if (!timestamp) {
      this.logger.warn(
        `Timestamp not found for path ${formatOptions.timestampPath!} in ${JSON.stringify(
          data
        )}. Using OIBus timestamp "${messageTimestamp}" instead`
      );
      return messageTimestamp;
    }
    return convertDateTimeToInstant(timestamp, {
      type: formatOptions.timestampType!,
      timezone: formatOptions.timezone!,
      format: formatOptions.timestampFormat!
    });
  }

  wildcardTopic(topic: string, wildcard: string): Array<string> | null {
    if (topic === wildcard) {
      return [];
    } else if (wildcard === '#') {
      return [topic];
    }

    const res = [];
    const t = topic.split('/');
    const w = wildcard.split('/');

    for (let i = 0; i < t.length; i++) {
      if (w[i] === '+') {
        res.push(t[i]);
      } else if (w[i] === '#') {
        res.push(t.slice(i).join('/'));
        return res;
      } else if (w[i] !== t[i]) {
        return null;
      }
    }

    if (t.length === w.length) return res;
    else return null;
  }

  // Custom log function using Pino
  mqttLog(...args: Array<object | string>) {
    // Log all arguments as a single message
    this.logger.trace(args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' '));
  }
}
