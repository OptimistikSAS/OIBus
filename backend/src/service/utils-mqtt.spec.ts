import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from './encryption.service';
import * as utils from './utils-mqtt';
import fs from 'node:fs/promises';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import path from 'node:path';
import { SouthMQTTItemSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';

jest.mock('node:fs/promises');
jest.mock('./utils');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));
const logger: pino.Logger = new PinoLogger();

const items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    settings: {
      topic: 'my/first/topic'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    settings: {
      topic: 'my/+/+/topic/with/wildcard/#'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    settings: {
      topic: 'my/wrong/topic////'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id4',
    name: 'item4',
    enabled: true,
    settings: {
      topic: 'json/topic'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id5',
    name: 'item5',
    enabled: true,
    settings: {
      topic: 'json/topic'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id6',
    name: 'item6',
    enabled: true,
    settings: {
      topic: 'json/topic'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  // Additional test items for edge cases
  {
    id: 'id7',
    name: 'item7',
    enabled: false, // Disabled item
    settings: {
      topic: 'disabled/topic'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id8',
    name: 'item8',
    enabled: true,
    settings: {
      topic: 'my/second/topic' // Duplicate topic with id1
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id9',
    name: 'item9',
    enabled: true,
    settings: {
      topic: 'my/second/topic' // Duplicate topic with id1
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  },
  {
    id: 'id10',
    name: 'item10',
    enabled: true,
    settings: {
      topic: 'simple/+' // Simple wildcard
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
    groups: [],
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    overlap: null
  }
];
describe('Service utils MQTT', () => {
  describe('createConnectionOptions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

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
      expect(result).toEqual({
        reconnectPeriod: 0, // managed by OIBus
        connectTimeout: 10_000,
        rejectUnauthorized: false,
        queueQoSZero: false,
        clean: true,
        log: expect.any(Function),
        resubscribe: false,
        clientId: 'connectorId'
      });

      expect(encryptionService.decryptText).not.toHaveBeenCalled();
      result.log!('test');
      expect(logger.trace).toHaveBeenCalledWith('test');

      result.log!({ object: 'test' });
      expect(logger.trace).toHaveBeenCalledWith(JSON.stringify({ object: 'test' }));
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
      expect(result).toEqual({
        reconnectPeriod: 0, // managed by OIBus
        connectTimeout: 10_000,
        rejectUnauthorized: false,
        queueQoSZero: false,
        log: expect.any(Function),
        resubscribe: true,
        clean: false,
        clientId: 'connectorId',
        username: 'username',
        password: 'password'
      });

      expect(encryptionService.decryptText).toHaveBeenCalledWith('password');
    });

    it('should create connection options with cert', async () => {
      (fs.readFile as jest.Mock).mockReturnValueOnce('cert').mockReturnValueOnce('key').mockReturnValueOnce('ca');
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
      expect(result).toEqual({
        reconnectPeriod: 0, // managed by OIBus
        connectTimeout: 10_000,
        rejectUnauthorized: false,
        queueQoSZero: false,
        log: expect.any(Function),
        resubscribe: false,
        clean: true,
        clientId: 'connectorId',
        cert: 'cert',
        key: 'key',
        ca: 'ca'
      });

      expect(encryptionService.decryptText).not.toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve('cert'));
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve('key'));
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve('ca'));
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
      expect(result).toEqual({
        reconnectPeriod: 0, // managed by OIBus
        connectTimeout: 10_000,
        rejectUnauthorized: false,
        queueQoSZero: false,
        log: expect.any(Function),
        resubscribe: false,
        clean: true,
        clientId: 'connectorId',
        cert: '',
        key: '',
        ca: ''
      });

      expect(encryptionService.decryptText).not.toHaveBeenCalled();
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('getItem', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return the correct item for an exact topic match (id1)', () => {
      const result = utils.getItem('my/first/topic', items);
      expect(result).toEqual(items[0]);
    });

    it('should return the correct item for a complex wildcard topic match (id2)', () => {
      const result = utils.getItem('my/level1/level2/topic/with/wildcard/extra/levels', items);
      expect(result).toEqual(items[1]);
    });

    it('should handle topics with consecutive slashes (id3)', () => {
      const result = utils.getItem('my/wrong/topic////', items);
      expect(result).toEqual(items[2]);
    });

    it('should return the correct item for json/topic (id4, id5, or id6)', () => {
      // Note: id4, id5, and id6 all have the same topic, which would cause an error
      // This test would fail, demonstrating the duplicate topic issue
      expect(() => utils.getItem('json/topic', items)).toThrow(/Topic "json\/topic" should be subscribed only once/);
    });

    it('should throw an error when no item matches the topic', () => {
      expect(() => utils.getItem('non/existent/topic', items)).toThrow("Item can't be determined from topic non/existent/topic");
    });

    it('should throw an error when multiple items match the topic (id8 and id9)', () => {
      expect(() => utils.getItem('my/second/topic', items)).toThrow(/Topic "my\/second\/topic" should be subscribed only once/);
    });

    it('should throw an error when trying to match a disabled item (id7)', () => {
      expect(() => utils.getItem('disabled/topic', items)).toThrow("Item can't be determined from topic disabled/topic");
    });

    it('should return the correct item for a simple wildcard match (id10)', () => {
      const result = utils.getItem('simple/match', items);
      expect(result).toEqual(items[9]);
    });

    it('should match when wildcard count matches path chunks (id2)', () => {
      // Topic has 3 wildcards (+/+/#) which should match 3+ path chunks
      const result = utils.getItem('my/level1/level2/topic/with/wildcard/extra', items);
      expect(result).toEqual(items[1]);
    });

    it('should not match when wildcard count does not match path chunks (id2)', () => {
      // This should fail because the topic has 3 wildcards but we're only providing 2 path chunks
      expect(() => utils.getItem('my/level1/topic/with/wildcard', items)).toThrow(
        "Item can't be determined from topic my/level1/topic/with/wildcard"
      );
    });

    it('should handle empty items array', () => {
      expect(() => utils.getItem('any/topic', [])).toThrow("Item can't be determined from topic any/topic");
    });

    describe('Testing with a filtered items list to avoid duplicates', () => {
      const filteredItems = [items[0], items[1], items[2], items[6], items[9]]; // Exclude duplicate topics

      it('should return the correct item for an exact topic match', () => {
        const result = utils.getItem('my/first/topic', filteredItems);
        expect(result).toEqual(items[0]);
      });

      it('should return the correct item for a complex wildcard topic match', () => {
        const result = utils.getItem('my/level1/level2/topic/with/wildcard/extra/levels', filteredItems);
        expect(result).toEqual(items[1]);
      });

      it('should return the correct item for a simple wildcard match', () => {
        const result = utils.getItem('simple/match', filteredItems);
        expect(result).toEqual(items[9]);
      });
    });
  });

  describe('wildcardTopic', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should check wildcard', () => {
      expect(utils.wildcardTopic('/my/topic', '/my/topic')).toEqual([]);
      expect(utils.wildcardTopic('/my/topic', '#')).toEqual(['/my/topic']);
      expect(utils.wildcardTopic('/my/test/topic', '/my/+/topic')).toEqual(['test']);
      expect(utils.wildcardTopic('/my/topic/test', '/my/topic/#')).toEqual(['test']);
      expect(utils.wildcardTopic('/my/topic/test/leaf', '/my/topic/#')).toEqual(['test/leaf']);
      expect(utils.wildcardTopic('/my/topic/test', '/my/topic/wrong/with/more/fields')).toEqual(null);
      expect(utils.wildcardTopic('/my/topic/test', '/my/topic/test/with/more/fields')).toEqual(null);
    });
  });
});
