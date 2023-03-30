import mqtt, { QoS, IClientOptions, MqttClient } from 'mqtt';
import { vsprintf } from 'sprintf-js';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';

import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { Timezone } from '../../../../shared/model/types';

interface MessageFormatOption {
  timestampOrigin: 'payload' | 'oibus';
  timestampPath: string;
  timestampFormat: 'string';
  timezone: Timezone;
  valuePath: string;
  pointIdPath: string;
  qualityPath: string;
}

/**
 * Class SouthMQTT - Subscribe to data topic from a MQTT broker
 */
export default class SouthMQTT extends SouthConnector {
  static category = manifest.category;

  private client: MqttClient | null = null;
  private mqttItems: Array<OibusItemDTO> = [];
  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode,
      manifest
    );
  }

  override async connect(): Promise<void> {
    this.logger.info(`Connecting to ${this.configuration.settings.url}`);

    const options: IClientOptions = {
      username: this.configuration.settings.authentication.type === 'basic' ? this.configuration.settings.authentication.username : '',
      password:
        this.configuration.settings.authentication.type === 'basic'
          ? Buffer.from(await this.encryptionService.decryptText(this.configuration.settings.authentication.password)).toString()
          : '',
      key: this.configuration.settings.keyFile ? await fs.readFile(path.resolve(this.configuration.settings.keyFile)) : '',
      cert: this.configuration.settings.certFile ? await fs.readFile(path.resolve(this.configuration.settings.certFile)) : '',
      ca: this.configuration.settings.caFile ? await fs.readFile(path.resolve(this.configuration.settings.caFile)) : '',
      rejectUnauthorized: this.configuration.settings.rejectUnauthorized,
      reconnectPeriod: this.configuration.settings.reconnectPeriod,
      connectTimeout: this.configuration.settings.connectTimeout,
      clientId: this.configuration.id,
      clean: !this.configuration.settings.persistent
    };
    this.client = mqtt.connect(this.configuration.settings.url, options);
    this.client.on('connect', async () => {
      this.logger.info(`Connected to ${this.configuration.settings.url}`);
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

  async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const formatOptions: MessageFormatOption = {
        timestampPath: this.configuration.settings.timestampPath,
        timestampOrigin: this.configuration.settings.timestampOrigin,
        timestampFormat: this.configuration.settings.timestampFormat,
        timezone: this.configuration.settings.timezone,
        valuePath: this.configuration.settings.valuePath,
        pointIdPath: this.configuration.settings.pointIdPath,
        qualityPath: this.configuration.settings.qualityPath
      };

      if (this.configuration.settings.dataArrayPath) {
        // if a path is set to get the data array from the message
        if (parsedMessage[this.configuration.settings.dataArrayPath]) {
          // if the data array exists at this path
          const dataArray = parsedMessage[this.configuration.settings.dataArrayPath]
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
            `Could not find the dataArrayPath "${this.configuration.settings.dataArrayPath}" in message "${JSON.stringify(parsedMessage)}".`
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

  override async subscribe(items: Array<OibusItemDTO>): Promise<void> {
    if (!this.client) {
      this.logger.error('MQTT client could not subscribe to items: client not set');
      return;
    }
    for (const item of items) {
      this.client.subscribe(item.settings.topic, { qos: parseInt(this.configuration.settings.qos) as QoS }, subscriptionError => {
        if (subscriptionError) {
          this.logger.error(`Error in MQTT subscription for topic ${item.settings.topic}: ${subscriptionError}`);
        }
      });
    }
    this.mqttItems = items;
  }

  formatValue(data: any, topic: string, formatOptions: MessageFormatOption, items: Array<OibusItemDTO>) {
    const { timestampPath, timestampOrigin, timestampFormat, timezone, valuePath, pointIdPath, qualityPath } = formatOptions;
    const dataPointId = this.getPointId(topic, data, pointIdPath, items);

    const dataTimestamp = this.getTimestamp(data[timestampPath], timestampOrigin, timestampFormat, timezone);
    const dataValue = data[valuePath];
    const dataQuality = data[qualityPath];
    // delete fields to avoid duplicates in the returned object
    delete data[timestampPath];
    delete data[valuePath];
    delete data[pointIdPath];
    delete data[qualityPath];
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

  getPointId(topic: string, currentData: any, pointIdPath: string, items: Array<OibusItemDTO>): string | null {
    if (pointIdPath) {
      // if the pointId is in the data
      if (!currentData[pointIdPath]) {
        throw new Error(`Could node find pointId in path "${pointIdPath}" for data: ${JSON.stringify(currentData)}`);
      }
      return currentData[pointIdPath];
    }

    // else, the pointId is in the topic
    let pointId = null;
    const matchedPoints: Array<OibusItemDTO> = [];

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
    let timestamp = DateTime.now().toUTC().toISO();
    if (timestampOrigin === 'payload') {
      if (timezone && elementTimestamp) {
        if (DateTime.fromISO(elementTimestamp).isValid) {
          timestamp = DateTime.fromISO(elementTimestamp).toUTC().toISO();
        }
        timestamp = DateTime.fromFormat(elementTimestamp, timestampFormat, { zone: timezone }).toUTC().toISO();
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
      this.logger.info(`Disconnecting from ${this.configuration.settings.url}...`);
    }
    await super.disconnect();
  }
}
