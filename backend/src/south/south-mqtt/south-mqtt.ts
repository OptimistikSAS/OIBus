import mqtt from 'mqtt';
import { QoS } from 'mqtt-packet';

import objectPath from 'object-path';
import SouthConnector from '../south-connector';
import manifest from './manifest';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';

import pino from 'pino';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { Instant } from '../../../../shared/model/types';
import { QueriesSubscription } from '../south-interface';
import {
  SouthMQTTItemSettings,
  SouthMQTTItemSettingsJsonPayloadTimestampPayload,
  SouthMQTTSettings
} from '../../../../shared/model/south-settings.model';
import { convertDateTimeToInstant } from '../../service/utils';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthMQTT - Subscribe to data topic from a MQTT broker
 */
export default class SouthMQTT extends SouthConnector<SouthMQTTSettings, SouthMQTTItemSettings> implements QueriesSubscription {
  static type = manifest.id;

  private client: mqtt.MqttClient | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthMQTTSettings>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusTimeValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
  }

  override async connect(): Promise<void> {
    this.logger.info(`Connecting to "${this.connector.settings.url}"`);
    const options = await this.createConnectionOptions();

    this.client = mqtt.connect(this.connector.settings.url, options);
    this.client.on('connect', async () => {
      this.logger.info(`Connected to ${this.connector.settings.url}`);
      await super.connect();
    });
    this.client.on('error', error => {
      this.logger.error(`MQTT connection error ${error}`);
    });
    this.client.on('message', async (topic, message, packet) => {
      this.logger.trace(`MQTT message for topic ${topic}: ${message}, dup:${packet.dup}`);
      await this.handleMessage(topic, message);
    });
  }

  override async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}...`);
      this.client = null;
    }
    await super.disconnect();
  }

  override async testConnection(): Promise<void> {
    const options = await this.createConnectionOptions();
    await this.testConnectionToBroker(options);
  }

  async testConnectionToBroker(options: mqtt.IClientOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.connector.settings.url, options);
      client.on('connect', () => {
        this.logger.info(`Connection test to "${this.connector.settings.url}" successful`);
        client.end(true);
        resolve();
      });
      client.on('error', error => {
        this.logger.error(`MQTT connection error. ${error}`);
        client.end(true);
        reject(`MQTT connection error. ${error}`);
      });
    });
  }

  async createConnectionOptions(): Promise<mqtt.IClientOptions> {
    const options: mqtt.IClientOptions = {
      rejectUnauthorized: this.connector.settings.rejectUnauthorized,
      reconnectPeriod: this.connector.settings.reconnectPeriod,
      connectTimeout: this.connector.settings.connectTimeout,
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

  async subscribe(items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      this.logger.error('MQTT client could not subscribe to items: client not set');
      return;
    }

    for (const item of items) {
      this.client.subscribe(item.settings.topic, { qos: parseInt(this.connector.settings.qos) as QoS }, subscriptionError => {
        if (subscriptionError) {
          this.logger.error(`Error in MQTT subscription for topic ${item.settings.topic}. ${subscriptionError}`);
        }
      });
    }
  }

  async unsubscribe(items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      this.logger.warn('MQTT client is not set. Nothing to unsubscribe');
      return;
    }
    for (const item of items) {
      this.client.unsubscribe(item.settings.topic);
    }
  }

  async handleMessage(topic: string, message: Buffer): Promise<void> {
    const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
    try {
      const associatedItem = this.getItem(topic);

      switch (associatedItem.settings.valueType) {
        case 'number':
          await this.addValues([
            {
              pointId: associatedItem.name,
              timestamp: messageTimestamp,
              data: {
                value: message.toString()
              }
            }
          ]);
          break;
        case 'string':
          await this.addValues([
            {
              pointId: associatedItem.name,
              timestamp: messageTimestamp,
              data: {
                value: message.toString()
              }
            }
          ]);
          break;
        case 'json':
          await this.addValues(this.formatValues(associatedItem, JSON.parse(message.toString()), messageTimestamp));
          break;
      }
    } catch (error) {
      this.logger.error(`Could not handle message "${message.toString()}" for topic "${topic}". ${error}`);
    }
  }

  formatValues(item: SouthConnectorItemDTO<SouthMQTTItemSettings>, data: any, messageTimestamp: Instant): Array<OIBusTimeValue> {
    if (item.settings.jsonPayload!.useArray) {
      const array = objectPath.get(data, item.settings.jsonPayload!.dataArrayPath!);
      if (!array || !Array.isArray(array)) {
        throw new Error(`Array not found for path ${item.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify(data)}`);
      }
      return array.map((element: any) => this.formatValue(item, element, messageTimestamp));
    }
    return [this.formatValue(item, data, messageTimestamp)];
  }

  formatValue(item: SouthConnectorItemDTO<SouthMQTTItemSettings>, data: any, messageTimestamp: Instant): OIBusTimeValue {
    const dataTimestamp =
      item.settings.jsonPayload!.timestampOrigin === 'oibus'
        ? messageTimestamp
        : this.getTimestamp(data, item.settings.jsonPayload!.timestampPayload!, messageTimestamp);

    const pointId =
      item.settings.jsonPayload!.pointIdOrigin === 'oibus'
        ? item.name
        : this.getPointId(data, item.settings.jsonPayload!.pointIdPath!, item.name);

    const dataValue: { value: string; [key: string]: any } = {
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

  getPointId(data: any, pointIdPath: string, itemName: string): string {
    const pointId = objectPath.get(data, pointIdPath!);
    if (!pointId) {
      this.logger.warn(`Point ID not found for path ${pointIdPath} in ${JSON.stringify(data)}. Using item name "${itemName}" instead`);
      return itemName;
    }
    return pointId;
  }

  getItem(topic: string): SouthConnectorItemDTO<SouthMQTTItemSettings> {
    const matchedPoints: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>> = [];

    for (const item of this.subscribedItems) {
      const matchList = this.wildcardTopic(topic, item.settings.topic);
      if (Array.isArray(matchList)) {
        const nrWildcards = (item.name.match(/[+#]/g) || []).length;
        if (nrWildcards === matchList.length) {
          matchedPoints.push(item);
        } else {
          throw new Error(`Invalid point configuration: ${JSON.stringify(item)}`);
        }
      }
    }

    if (matchedPoints.length > 1) {
      throw new Error(
        `Topic "${topic}" should be subscribed only once but it has the following subscriptions: ${JSON.stringify(matchedPoints)}`
      );
    } else if (matchedPoints.length === 0) {
      throw new Error(`Item can't be determined from topic ${topic}`);
    }

    return matchedPoints[0];
  }

  getTimestamp(data: any, formatOptions: SouthMQTTItemSettingsJsonPayloadTimestampPayload, messageTimestamp: Instant): string {
    const timestamp = objectPath.get(data, formatOptions.timestampPath!);
    if (!timestamp) {
      this.logger.warn(
        `Timestamp found for path ${formatOptions.timestampPath!} in ${JSON.stringify(
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
}
