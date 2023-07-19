import mqtt, { IClientOptions, MqttClient, QoS } from 'mqtt';
import { vsprintf } from 'sprintf-js';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { Instant, Timezone } from '../../../../shared/model/types';
import { QueriesSubscription, TestsConnection } from '../south-interface';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../../shared/model/south-settings.model';

interface MessageFormatOption {
  timestampOrigin: 'payload' | 'oibus';
  timestampPath: string;
  timestampFormat: string;
  timezone: Timezone;
  valuePath: string;
  pointIdPath: string;
  qualityPath: string | null;
}

/**
 * Class SouthMQTT - Subscribe to data topic from a MQTT broker
 */
export default class SouthMQTT
  extends SouthConnector<SouthMQTTSettings, SouthMQTTItemSettings>
  implements QueriesSubscription, TestsConnection
{
  static type = manifest.id;

  private client: MqttClient | null = null;
  private mqttItems: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>> = [];

  constructor(
    connector: SouthConnectorDTO<SouthMQTTSettings>,
    items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    testing = false
  ) {
    super(
      connector,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      repositoryService,
      logger,
      baseFolder,
      testing
    );
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

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.url}"`);
    const options = await this.createConnectionOptions();
    await this.testConnectionToBroker(options);
  }

  async testConnectionToBroker(options: IClientOptions): Promise<void> {
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

  async createConnectionOptions(): Promise<IClientOptions> {
    const options: IClientOptions = {
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

  async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const formatOptions: MessageFormatOption = {
        timestampPath: this.connector.settings.timestampPath!,
        timestampOrigin: this.connector.settings.timestampOrigin,
        timestampFormat: this.connector.settings.timestampFormat!,
        timezone: this.connector.settings.timestampTimezone!,
        valuePath: this.connector.settings.valuePath,
        pointIdPath: this.connector.settings.pointIdPath,
        qualityPath: this.connector.settings.qualityPath
      };

      if (this.connector.settings.dataArrayPath) {
        // if a path is set to get the data array from the message
        if (parsedMessage[this.connector.settings.dataArrayPath]) {
          // if the data array exists at this path
          const dataArray = parsedMessage[this.connector.settings.dataArrayPath]
            .map((data: any) => {
              try {
                return this.formatValue(data, topic, formatOptions, this.mqttItems);
              } catch (formatError) {
                this.logger.error(formatError);
                return null;
              }
            })
            .filter((data: any) => data !== null);
          // Send a formatted array of values
          if (dataArray.length > 0) {
            await this.addValues(dataArray);
          }
        } else {
          this.logger.error(
            `Could not find the dataArrayPath "${this.connector.settings.dataArrayPath}" in message "${JSON.stringify(parsedMessage)}".`
          );
        }
      } else {
        // if the message contains only one value as a json
        try {
          const formattedValue = this.formatValue(parsedMessage, topic, formatOptions, this.mqttItems);
          await this.addValues([formattedValue]);
        } catch (formatError) {
          this.logger.error(formatError);
        }
      }
    } catch (error) {
      this.logger.error(`Could not parse message "${message}" for topic "${topic}". ${error}`);
    }
  }

  async subscribe(items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      this.logger.error('MQTT client could not subscribe to items: client not set');
      return;
    }
    for (const item of items) {
      this.client.subscribe(item.settings.topic, { qos: parseInt(this.connector.settings.qos) as QoS }, subscriptionError => {
        if (subscriptionError) {
          this.logger.error(`Error in MQTT subscription for topic ${item.settings.topic}: ${subscriptionError}`);
        }
      });
    }
    this.mqttItems = items;
  }

  async unsubscribe(items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>): Promise<void> {
    if (!this.client) {
      return;
    }
    for (const item of items) {
      this.client.unsubscribe(item.settings.topic);
    }
  }

  formatValue(data: any, topic: string, formatOptions: MessageFormatOption, items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>) {
    const { timestampPath, timestampOrigin, timestampFormat, timezone, valuePath, pointIdPath, qualityPath } = formatOptions;
    const dataPointId = this.getPointId(topic, data, pointIdPath, items);

    const dataTimestamp = this.getTimestamp(data[timestampPath], timestampOrigin, timestampFormat, timezone);
    const dataValue = data[valuePath];
    // todo @burgerni look into this to render quality path
    const dataQuality = data[qualityPath!];
    // delete fields to avoid duplicates in the returned object
    delete data[timestampPath];
    delete data[valuePath];
    delete data[pointIdPath];
    // todo @burgerni look into this to render quality path
    delete data[qualityPath!];
    return {
      pointId: dataPointId,
      timestamp: dataTimestamp,
      data: {
        ...data,
        value: dataValue,
        quality: dataQuality
      }
    };
  }

  getPointId(
    topic: string,
    currentData: any,
    pointIdPath: string,
    items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>>
  ): string | null {
    if (pointIdPath) {
      // if the pointId is in the data
      if (!currentData[pointIdPath]) {
        throw new Error(`Could node find pointId in path "${pointIdPath}" for data: ${JSON.stringify(currentData)}`);
      }
      return currentData[pointIdPath];
    }

    // else, the pointId is in the topic
    let pointId = null;
    const matchedPoints: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>> = [];

    for (const item of items) {
      const matchList = this.wildcardTopic(topic, item.settings.topic);
      if (Array.isArray(matchList)) {
        if (!pointId) {
          const nrWildcards = (item.name.match(/[+#]/g) || []).length;
          if (nrWildcards === matchList.length) {
            const normalizedPointId = item.name.replace(/[+#]/g, '%s');
            pointId = vsprintf(normalizedPointId, matchList);
            matchedPoints.push(item);
          } else {
            throw new Error(`Invalid point configuration: ${JSON.stringify(item)}`);
          }
        } else {
          matchedPoints.push(item);
        }
      }
    }

    if (matchedPoints.length > 1) {
      throw new Error(
        `Topic "${topic}" should be subscribed only once but it has the following subscriptions: ${JSON.stringify(matchedPoints)}`
      );
    } else if (!pointId) {
      throw new Error(`PointId can't be determined. The following value ${JSON.stringify(currentData)} is not saved.`);
    }

    return pointId;
  }

  getTimestamp(elementTimestamp: string, timestampOrigin: 'payload' | 'oibus', timestampFormat: string, timezone: Timezone): string {
    let timestamp: Instant = DateTime.now().toUTC().toISO() as Instant;
    if (timestampOrigin === 'payload') {
      if (timezone && elementTimestamp) {
        if (DateTime.fromISO(elementTimestamp).isValid) {
          timestamp = DateTime.fromISO(elementTimestamp).toUTC().toISO() as Instant;
        }
        timestamp = DateTime.fromFormat(elementTimestamp, timestampFormat, { zone: timezone }).toUTC().toISO() as Instant;
      }
    }
    return timestamp;
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

    if (w[t.length - 1] === '#') {
      return t.length + 1 === w.length ? res : null;
    }
    return t.length === w.length ? res : null;
  }

  override async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}...`);
    }
    await super.disconnect();
  }
}
