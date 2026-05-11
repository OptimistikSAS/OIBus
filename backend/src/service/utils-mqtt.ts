import fs from 'node:fs/promises';
import path from 'node:path';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../shared/model/south-settings.model';
import { encryptionService } from './encryption.service';
import mqtt from 'mqtt';
import pino from 'pino';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
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

// Per-item pre-computed match metadata, cached by item reference. The cache
// auto-evicts when items are GC'd. The `topic` field guards against in-place
// mutation: if the underlying topic string was swapped, we re-derive parts.
interface ItemMqttMeta {
  topic: string;
  parts: ReadonlyArray<string>;
  wildcardCount: number;
}
const itemMetaCache = new WeakMap<SouthConnectorItemEntity<SouthMQTTItemSettings>, ItemMqttMeta>();

const getItemMeta = (item: SouthConnectorItemEntity<SouthMQTTItemSettings>): ItemMqttMeta => {
  const cached = itemMetaCache.get(item);
  const topic = item.settings.topic;
  if (cached && cached.topic === topic) {
    return cached;
  }
  const parts = topic.split('/');
  let wildcardCount = 0;
  for (const p of parts) {
    if (p === '+' || p === '#') wildcardCount++;
  }
  const meta: ItemMqttMeta = { topic, parts, wildcardCount };
  itemMetaCache.set(item, meta);
  return meta;
};

// Equivalent to wildcardTopic's match-length, computed on pre-split parts so the
// caller can split the inbound topic once and reuse it across every item check.
// Returns null on no-match, otherwise the number of wildcard captures (which the
// caller compares against the cached wildcardCount — same correctness check as
// before, just without re-running the [+#] regex per call).
const countWildcardMatches = (
  topicParts: ReadonlyArray<string>,
  wildcardParts: ReadonlyArray<string>,
  topic: string,
  wildcard: string
): number | null => {
  if (topic === wildcard) return 0;
  if (wildcard === '#') return 1;
  let captures = 0;
  for (let i = 0; i < topicParts.length; i++) {
    const w = wildcardParts[i];
    if (w === '+') {
      captures++;
    } else if (w === '#') {
      return captures + 1;
    } else if (w !== topicParts[i]) {
      return null;
    }
  }
  return topicParts.length === wildcardParts.length ? captures : null;
};

export const getItem = (
  topic: string,
  items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>
): SouthConnectorItemEntity<SouthMQTTItemSettings> => {
  const topicParts = topic.split('/');
  const matchingItems: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>> = [];

  for (const item of items) {
    if (!item.enabled) continue;
    const meta = getItemMeta(item);
    const captures = countWildcardMatches(topicParts, meta.parts, topic, meta.topic);
    if (captures !== null && captures === meta.wildcardCount) {
      matchingItems.push(item);
    }
  }

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
