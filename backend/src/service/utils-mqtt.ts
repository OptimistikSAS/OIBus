import fs from 'node:fs/promises';
import path from 'node:path';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../shared/model/south-settings.model';
import { encryptionService } from './encryption.service';
import mqtt from 'mqtt';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { NorthMQTTSettings } from '../../shared/model/north-settings.model';
import type { ILogger } from '../model/logger.model';

export const createConnectionOptions = async (
  connectorId: string,
  connectionSettings: NorthMQTTSettings | SouthMQTTSettings,
  logger: ILogger
): Promise<mqtt.IClientOptions> => {
  const options: mqtt.IClientOptions = {
    reconnectPeriod: 0, // managed by OIBus
    connectTimeout: connectionSettings.connectTimeout,
    rejectUnauthorized: connectionSettings.rejectUnauthorized,
    queueQoSZero: false,
    log: (...args: Array<object | string>) => {
      // Log all arguments as a single message
      logger.trace(args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' '));
    },
    resubscribe: connectionSettings.persistent || false,
    clientId: connectorId
  };
  if (connectionSettings.authentication.type === 'basic') {
    options.username = connectionSettings.authentication.username;
    options.password = Buffer.from(await encryptionService.decryptText(connectionSettings.authentication.password!)).toString();
  } else if (connectionSettings.authentication.type === 'cert') {
    options.cert = connectionSettings.authentication.certFilePath
      ? await fs.readFile(path.resolve(connectionSettings.authentication.certFilePath))
      : '';
    options.key = connectionSettings.authentication.keyFilePath
      ? await fs.readFile(path.resolve(connectionSettings.authentication.keyFilePath))
      : '';
    options.ca = connectionSettings.authentication.caFilePath
      ? await fs.readFile(path.resolve(connectionSettings.authentication.caFilePath))
      : '';
  }
  options.clean = !connectionSettings.persistent;
  return options;
};

export const getItem = (
  topic: string,
  items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>
): SouthConnectorItemEntity<SouthMQTTItemSettings> => {
  const matchingItems = items.filter(item => {
    const matchList = wildcardTopic(topic, item.settings.topic);
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
};

export const wildcardTopic = (topic: string, wildcard: string): Array<string> | null => {
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
};
