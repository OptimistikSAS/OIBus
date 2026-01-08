import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SouthMQTTItemSettings,
  SouthMQTTItemSettingsJsonPayloadTimestampPayload,
  SouthMQTTSettings
} from '../../shared/model/south-settings.model';
import { encryptionService } from './encryption.service';
import mqtt from 'mqtt';
import pino from 'pino';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { Instant } from '../../shared/model/types';
import { OIBusTimeValue } from '../../shared/model/engine.model';
import objectPath from 'object-path';
import { convertDateTimeToInstant } from './utils';
import { DateTime } from 'luxon';
import { NorthMQTTSettings } from '../../shared/model/north-settings.model';

export const createConnectionOptions = async (
  connectorId: string,
  connectionSettings: NorthMQTTSettings | SouthMQTTSettings,
  logger: pino.Logger
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

export const parseMessage = (
  topic: string,
  message: string,
  associatedItem: SouthConnectorItemEntity<SouthMQTTItemSettings>,
  logger: pino.Logger
): Array<OIBusTimeValue> => {
  const messageTimestamp: Instant = DateTime.now().toUTC().toISO()!;
  try {
    return createContent(associatedItem, message, messageTimestamp, logger);
  } catch (error: unknown) {
    logger.error(`Could not handle message "${message.toString()}" for topic "${topic}": ${(error as Error).message}`);
    return [];
  }
};

export const createContent = (
  associatedItem: SouthConnectorItemEntity<SouthMQTTItemSettings>,
  message: string,
  messageTimestamp: Instant,
  logger: pino.Logger
): Array<OIBusTimeValue> => {
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
      return formatValues(associatedItem, JSON.parse(message), messageTimestamp, logger);
  }
};

export const formatValues = (
  item: SouthConnectorItemEntity<SouthMQTTItemSettings>,
  data: object,
  messageTimestamp: Instant,
  logger: pino.Logger
): Array<OIBusTimeValue> => {
  if (item.settings.jsonPayload!.useArray) {
    const array = objectPath.get(data, item.settings.jsonPayload!.dataArrayPath!);
    if (!array || !Array.isArray(array)) {
      throw new Error(`Array not found for path ${item.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify(data)}`);
    }
    return array.map((element: Array<object>) => formatValue(item, element, messageTimestamp, logger));
  }
  return [formatValue(item, data, messageTimestamp, logger)];
};

export const formatValue = (
  item: SouthConnectorItemEntity<SouthMQTTItemSettings>,
  data: object,
  messageTimestamp: Instant,
  logger: pino.Logger
): OIBusTimeValue => {
  const dataTimestamp =
    item.settings.jsonPayload!.timestampOrigin === 'oibus'
      ? messageTimestamp
      : getTimestamp(data, item.settings.jsonPayload!.timestampPayload!, messageTimestamp, logger);

  const pointId =
    item.settings.jsonPayload!.pointIdOrigin === 'oibus'
      ? item.name
      : getPointId(data, item.settings.jsonPayload!.pointIdPath!, item.name, logger);

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
};

export const getPointId = (data: object, pointIdPath: string, itemName: string, logger: pino.Logger): string => {
  const pointId = objectPath.get(data, pointIdPath);
  if (!pointId || typeof pointId !== 'string') {
    logger.warn(`Point ID not found for path ${pointIdPath} in ${JSON.stringify(data)}. Using item name "${itemName}" instead`);
    return itemName;
  }
  return pointId;
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

export const getTimestamp = (
  data: object,
  formatOptions: SouthMQTTItemSettingsJsonPayloadTimestampPayload,
  messageTimestamp: Instant,
  logger: pino.Logger
): string => {
  const timestamp = objectPath.get(data, formatOptions.timestampPath!);
  if (!timestamp) {
    logger.warn(
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
};
