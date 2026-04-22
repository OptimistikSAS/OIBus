import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { encryptionService } from './encryption.service';
import * as utils from './utils-mqtt';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SouthMQTTItemSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';

const scanMode = {
  id: 'subscription',
  name: 'subscription',
  description: '',
  cron: '',
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};
const auditFields = { createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' };
const items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    settings: { topic: 'my/first/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    settings: { topic: 'my/+/+/topic/with/wildcard/#' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    settings: { topic: 'my/wrong/topic////' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id4',
    name: 'item4',
    enabled: true,
    settings: { topic: 'json/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id5',
    name: 'item5',
    enabled: true,
    settings: { topic: 'json/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id6',
    name: 'item6',
    enabled: true,
    settings: { topic: 'json/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id7',
    name: 'item7',
    enabled: false,
    settings: { topic: 'disabled/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id8',
    name: 'item8',
    enabled: true,
    settings: { topic: 'my/second/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id9',
    name: 'item9',
    enabled: true,
    settings: { topic: 'my/second/topic' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id10',
    name: 'item10',
    enabled: true,
    settings: { topic: 'simple/+' },
    scanMode,
    ...auditFields,
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  }
];

describe('Service utils MQTT', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = new PinoLogger() as unknown as pino.Logger;
    mock.method(encryptionService, 'decryptText', async (text: unknown) => text);
    mock.method(fs, 'readFile', async () => '');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('createConnectionOptions', () => {
    it('should create connection options without auth', async () => {
      const result = await utils.createConnectionOptions(
        'connectorId',
        {
          url: 'url',
          qos: '1',
          reconnectPeriod: 10000,
          maxNumberOfMessages: 1000,
          flushMessageTimeout: 100,
          authentication: {
            type: 'none'
          },
          rejectUnauthorized: false,
          connectTimeout: 10_000,
          persistent: false
        },
        logger
      );
      assert.deepStrictEqual(
        { ...result, log: undefined },
        {
          reconnectPeriod: 0,
          connectTimeout: 10_000,
          rejectUnauthorized: false,
          queueQoSZero: false,
          clean: true,
          log: undefined,
          resubscribe: false,
          clientId: 'connectorId'
        }
      );
      assert.strictEqual(typeof result.log, 'function');
      assert.strictEqual((encryptionService.decryptText as ReturnType<typeof mock.fn>).mock.calls.length, 0);

      result.log!('test');
      assert.deepStrictEqual((logger.trace as ReturnType<typeof mock.fn>).mock.calls[0].arguments, ['test']);

      result.log!({ object: 'test' });
      assert.deepStrictEqual((logger.trace as ReturnType<typeof mock.fn>).mock.calls[1].arguments, [JSON.stringify({ object: 'test' })]);
    });

    it('should create connection options with password', async () => {
      const result = await utils.createConnectionOptions(
        'connectorId',
        {
          url: 'url',
          persistent: true,
          qos: '1',
          reconnectPeriod: 10000,
          maxNumberOfMessages: 1000,
          flushMessageTimeout: 100,
          authentication: {
            type: 'basic',
            username: 'username',
            password: 'password'
          },
          rejectUnauthorized: false,
          connectTimeout: 10_000
        },
        logger
      );
      assert.deepStrictEqual(
        { ...result, log: undefined },
        {
          reconnectPeriod: 0,
          connectTimeout: 10_000,
          rejectUnauthorized: false,
          queueQoSZero: false,
          log: undefined,
          resubscribe: true,
          clean: false,
          clientId: 'connectorId',
          username: 'username',
          password: 'password'
        }
      );
      assert.deepStrictEqual((encryptionService.decryptText as ReturnType<typeof mock.fn>).mock.calls[0].arguments, ['password']);
    });

    it('should create connection options with cert', async () => {
      (fs.readFile as ReturnType<typeof mock.fn>).mock.mockImplementation(async (filePath: unknown) => {
        const p = String(filePath);
        if (p.endsWith('cert')) return 'cert';
        if (p.endsWith('key')) return 'key';
        if (p.endsWith('ca')) return 'ca';
        return '';
      });
      const result = await utils.createConnectionOptions(
        'connectorId',
        {
          url: 'url',
          persistent: false,
          qos: '1',
          reconnectPeriod: 10000,
          maxNumberOfMessages: 1000,
          flushMessageTimeout: 100,
          authentication: {
            type: 'cert',
            certFilePath: 'cert',
            keyFilePath: 'key',
            caFilePath: 'ca'
          },
          rejectUnauthorized: false,
          connectTimeout: 10_000
        },
        logger
      );
      assert.deepStrictEqual(
        { ...result, log: undefined },
        {
          reconnectPeriod: 0,
          connectTimeout: 10_000,
          rejectUnauthorized: false,
          queueQoSZero: false,
          log: undefined,
          resubscribe: false,
          clean: true,
          clientId: 'connectorId',
          cert: 'cert',
          key: 'key',
          ca: 'ca'
        }
      );
      assert.strictEqual((encryptionService.decryptText as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual((fs.readFile as ReturnType<typeof mock.fn>).mock.calls.length, 3);
      assert.deepStrictEqual((fs.readFile as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], path.resolve('cert'));
      assert.deepStrictEqual((fs.readFile as ReturnType<typeof mock.fn>).mock.calls[1].arguments[0], path.resolve('key'));
      assert.deepStrictEqual((fs.readFile as ReturnType<typeof mock.fn>).mock.calls[2].arguments[0], path.resolve('ca'));
    });

    it('should create connection options without cert', async () => {
      const result = await utils.createConnectionOptions(
        'connectorId',
        {
          url: 'url',
          persistent: false,
          qos: '1',
          reconnectPeriod: 10000,
          maxNumberOfMessages: 1000,
          flushMessageTimeout: 100,
          authentication: {
            type: 'cert',
            certFilePath: '',
            keyFilePath: '',
            caFilePath: ''
          },
          rejectUnauthorized: false,
          connectTimeout: 10_000
        },
        logger
      );
      assert.deepStrictEqual(
        { ...result, log: undefined },
        {
          reconnectPeriod: 0,
          connectTimeout: 10_000,
          rejectUnauthorized: false,
          queueQoSZero: false,
          log: undefined,
          resubscribe: false,
          clean: true,
          clientId: 'connectorId',
          cert: '',
          key: '',
          ca: ''
        }
      );
      assert.strictEqual((encryptionService.decryptText as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual((fs.readFile as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    });
  });

  describe('getItem', () => {
    it('should return the correct item for an exact topic match (id1)', () => {
      assert.deepStrictEqual(utils.getItem('my/first/topic', items), items[0]);
    });

    it('should return the correct item for a complex wildcard topic match (id2)', () => {
      assert.deepStrictEqual(utils.getItem('my/level1/level2/topic/with/wildcard/extra/levels', items), items[1]);
    });

    it('should handle topics with consecutive slashes (id3)', () => {
      assert.deepStrictEqual(utils.getItem('my/wrong/topic////', items), items[2]);
    });

    it('should return the correct item for json/topic (id4, id5, or id6)', () => {
      assert.throws(() => utils.getItem('json/topic', items), /Topic "json\/topic" should be subscribed only once/);
    });

    it('should throw an error when no item matches the topic', () => {
      assert.throws(() => utils.getItem('non/existent/topic', items), {
        message: "Item can't be determined from topic non/existent/topic"
      });
    });

    it('should throw an error when multiple items match the topic (id8 and id9)', () => {
      assert.throws(() => utils.getItem('my/second/topic', items), /Topic "my\/second\/topic" should be subscribed only once/);
    });

    it('should throw an error when trying to match a disabled item (id7)', () => {
      assert.throws(() => utils.getItem('disabled/topic', items), { message: "Item can't be determined from topic disabled/topic" });
    });

    it('should return the correct item for a simple wildcard match (id10)', () => {
      assert.deepStrictEqual(utils.getItem('simple/match', items), items[9]);
    });

    it('should match when wildcard count matches path chunks (id2)', () => {
      assert.deepStrictEqual(utils.getItem('my/level1/level2/topic/with/wildcard/extra', items), items[1]);
    });

    it('should not match when wildcard count does not match path chunks (id2)', () => {
      assert.throws(() => utils.getItem('my/level1/topic/with/wildcard', items), {
        message: "Item can't be determined from topic my/level1/topic/with/wildcard"
      });
    });

    it('should handle empty items array', () => {
      assert.throws(() => utils.getItem('any/topic', []), { message: "Item can't be determined from topic any/topic" });
    });

    describe('Testing with a filtered items list to avoid duplicates', () => {
      const filteredItems = [items[0], items[1], items[2], items[6], items[9]];

      it('should return the correct item for an exact topic match', () => {
        assert.deepStrictEqual(utils.getItem('my/first/topic', filteredItems), items[0]);
      });

      it('should return the correct item for a complex wildcard topic match', () => {
        assert.deepStrictEqual(utils.getItem('my/level1/level2/topic/with/wildcard/extra/levels', filteredItems), items[1]);
      });

      it('should return the correct item for a simple wildcard match', () => {
        assert.deepStrictEqual(utils.getItem('simple/match', filteredItems), items[9]);
      });
    });
  });

  describe('wildcardTopic', () => {
    it('should check wildcard', () => {
      assert.deepStrictEqual(utils.wildcardTopic('/my/topic', '/my/topic'), []);
      assert.deepStrictEqual(utils.wildcardTopic('/my/topic', '#'), ['/my/topic']);
      assert.deepStrictEqual(utils.wildcardTopic('/my/test/topic', '/my/+/topic'), ['test']);
      assert.deepStrictEqual(utils.wildcardTopic('/my/topic/test', '/my/topic/#'), ['test']);
      assert.deepStrictEqual(utils.wildcardTopic('/my/topic/test/leaf', '/my/topic/#'), ['test/leaf']);
      assert.strictEqual(utils.wildcardTopic('/my/topic/test', '/my/topic/wrong/with/more/fields'), null);
      assert.strictEqual(utils.wildcardTopic('/my/topic/test', '/my/topic/test/with/more/fields'), null);
    });
  });
});
