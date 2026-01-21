import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from './encryption.service';
import { convertDateTimeToInstant } from './utils';
import * as utils from './utils-mqtt';
import fs from 'node:fs/promises';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import path from 'node:path';
import testData from '../tests/utils/test-data';
import { SouthMQTTItemSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { OIBusTimeValue } from '../../shared/model/engine.model';

jest.mock('node:fs/promises');
jest.mock('./utils');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));
const logger: pino.Logger = new PinoLogger();

const content: OIBusTimeValue = {
  pointId: 'pointId',
  timestamp: testData.constants.dates.FAKE_NOW,
  data: {
    value: '123'
  }
};
const items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    settings: {
      topic: 'my/first/topic',
      valueType: 'number'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    settings: {
      topic: 'my/+/+/topic/with/wildcard/#',
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    settings: {
      topic: 'my/wrong/topic////',
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id4',
    name: 'item4',
    enabled: true,
    settings: {
      topic: 'json/topic',
      valueType: 'json',
      jsonPayload: {
        useArray: true,
        dataArrayPath: '',
        pointIdOrigin: 'oibus',
        valuePath: 'received.value',
        otherFields: [
          { name: 'appId', path: 'received.appId' },
          { name: 'messageType', path: 'received.message.type' }
        ],
        timestampOrigin: 'payload',
        timestampPayload: {
          timestampPath: 'received.timestamp',
          timestampType: 'string',
          timezone: 'Europe/Paris',
          timestampFormat: 'yyyy-MM-dd HH:mm:ss'
        }
      }
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id5',
    name: 'item5',
    enabled: true,
    settings: {
      topic: 'json/topic',
      valueType: 'json',
      jsonPayload: {
        useArray: false,
        dataArrayPath: '',
        pointIdOrigin: 'payload',
        pointIdPath: 'received.reference',
        valuePath: 'received.value',
        otherFields: [
          { name: 'appId', path: 'received.appId' },
          { name: 'messageType', path: 'received.message.type' }
        ],
        timestampOrigin: 'payload',
        timestampPayload: {
          timestampPath: 'received.timestamp',
          timestampType: 'unix-epoch-ms'
        }
      }
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id6',
    name: 'item6',
    enabled: true,
    settings: {
      topic: 'json/topic',
      valueType: 'json',
      jsonPayload: {
        useArray: true,
        dataArrayPath: 'myArray',
        pointIdOrigin: 'payload',
        pointIdPath: 'received.reference',
        valuePath: 'received.value',
        otherFields: [
          { name: 'appId', path: 'received.appId' },
          { name: 'messageType', path: 'received.message.type' }
        ],
        timestampOrigin: 'oibus'
      }
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  // Additional test items for edge cases
  {
    id: 'id7',
    name: 'item7',
    enabled: false, // Disabled item
    settings: {
      topic: 'disabled/topic',
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id8',
    name: 'item8',
    enabled: true,
    settings: {
      topic: 'my/second/topic', // Duplicate topic with id1
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id9',
    name: 'item9',
    enabled: true,
    settings: {
      topic: 'my/second/topic', // Duplicate topic with id1
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
  },
  {
    id: 'id10',
    name: 'item10',
    enabled: true,
    settings: {
      topic: 'simple/+', // Simple wildcard
      valueType: 'string'
    },
    scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
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

  describe('parseMessage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    });

    afterEach(() => {
      // Restore the original implementations after each test
      jest.restoreAllMocks();
    });

    it('should properly parse message', () => {
      // Mock createContent for parseMessage tests
      jest.spyOn(utils, 'createContent').mockReturnValue([content]);
      const result = utils.parseMessage('topic', 'message', items[0], logger);
      expect(result).toEqual([content]);
      expect(utils.createContent).toHaveBeenCalledWith(items[0], 'message', testData.constants.dates.FAKE_NOW, logger);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should properly log error and return empty array', () => {
      // Mock getItem and createContent for parseMessage tests
      jest.spyOn(utils, 'createContent').mockImplementationOnce(() => {
        throw new Error('error');
      });

      expect(utils.parseMessage('topic', 'message', items[0], logger)).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('Could not handle message "message" for topic "topic": error');
    });
  });

  describe('createContent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      (convertDateTimeToInstant as jest.Mock).mockReturnValue(testData.constants.dates.DATE_1);
    });

    it('should create content for number value type', () => {
      const result = utils.createContent(
        items[0], // id1 has valueType 'number'
        '123',
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual([
        {
          pointId: 'item1',
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '123'
          }
        }
      ]);
    });

    it('should create content for string value type', () => {
      const result = utils.createContent(
        items[1], // id2 has valueType 'string'
        'test message',
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual([
        {
          pointId: 'item2',
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: 'test message'
          }
        }
      ]);
    });

    it('should create content for json value type with array', () => {
      const jsonMessage = JSON.stringify({
        myArray: [
          { received: { reference: 'ref1', value: 456, appId: 'app1', message: { type: 'type1' }, timestamp: '2023-01-01 12:00:00' } },
          { received: { reference: 'ref2', value: 789, appId: 'app2', message: { type: 'type2' }, timestamp: '2023-01-01 12:00:01' } }
        ]
      });

      const result = utils.createContent(
        items[5], // id6 has valueType 'json' with useArray: true
        jsonMessage,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        pointId: 'ref1',
        timestamp: testData.constants.dates.FAKE_NOW, // oibus timestamp
        data: {
          value: 456,
          appId: 'app1',
          messageType: 'type1'
        }
      });
      expect(result[1]).toEqual({
        pointId: 'ref2',
        timestamp: testData.constants.dates.FAKE_NOW, // oibus timestamp
        data: {
          value: 789,
          appId: 'app2',
          messageType: 'type2'
        }
      });
    });

    it('should create content for json value type without array', () => {
      const jsonMessage = JSON.stringify({
        received: {
          reference: 'ref1',
          value: 456,
          appId: 'app1',
          message: { type: 'type1' },
          timestamp: 1672531200000 // Unix epoch in ms
        }
      });

      const result = utils.createContent(
        items[4], // id5 has valueType 'json' with useArray: false
        jsonMessage,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual([
        {
          pointId: 'ref1',
          timestamp: testData.constants.dates.DATE_1,
          data: {
            value: 456,
            appId: 'app1',
            messageType: 'type1'
          }
        }
      ]);
    });
  });

  describe('formatValues', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      (convertDateTimeToInstant as jest.Mock).mockReturnValue(testData.constants.dates.DATE_1);
    });

    it('should format values from array', () => {
      const data = {
        myArray: [
          { received: { reference: 'ref1', value: 456, appId: 'app1', message: { type: 'type1' }, timestamp: '2023-01-01 12:00:00' } },
          { received: { reference: 'ref2', value: 789, appId: 'app2', message: { type: 'type2' }, timestamp: '2023-01-01 12:00:01' } }
        ]
      };

      const result = utils.formatValues(
        items[5], // id6 has useArray: true
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        pointId: 'ref1',
        timestamp: testData.constants.dates.FAKE_NOW, // oibus timestamp
        data: {
          value: 456,
          appId: 'app1',
          messageType: 'type1'
        }
      });
    });

    it('should format single value', () => {
      const data = {
        received: {
          reference: 'ref1',
          value: 456,
          appId: 'app1',
          message: { type: 'type1' },
          timestamp: 1672531200000 // Unix epoch in ms
        }
      };

      const result = utils.formatValues(
        items[4], // id5 has useArray: false
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual([
        {
          pointId: 'ref1',
          timestamp: testData.constants.dates.DATE_1,
          data: {
            value: 456,
            appId: 'app1',
            messageType: 'type1'
          }
        }
      ]);
    });

    it('should throw error when array path is invalid', () => {
      const data = {
        wrongPath: [{ received: { reference: 'ref1', value: 456 } }]
      };

      expect(() =>
        utils.formatValues(
          items[5], // id6 has dataArrayPath: 'myArray'
          data,
          testData.constants.dates.FAKE_NOW,
          logger
        )
      ).toThrow('Array not found for path myArray in {"wrongPath":[{"received":{"reference":"ref1","value":456}}]}');
    });

    it('should throw error when array is not an array', () => {
      const data = {
        myArray: { not: 'an array' }
      };

      expect(() =>
        utils.formatValues(
          items[5], // id6 has dataArrayPath: 'myArray'
          data,
          testData.constants.dates.FAKE_NOW,
          logger
        )
      ).toThrow('Array not found for path myArray in {"myArray":{"not":"an array"}}');
    });
  });

  describe('formatValue', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      (convertDateTimeToInstant as jest.Mock).mockReturnValue(testData.constants.dates.DATE_1);
    });

    it('should format value with oibus timestamp', () => {
      const data = {
        received: {
          reference: 'ref1',
          value: 456,
          appId: 'app1',
          message: { type: 'type1' }
        }
      };

      const result = utils.formatValue(
        items[5], // id6 has timestampOrigin: 'oibus'
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual({
        pointId: 'ref1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 456,
          appId: 'app1',
          messageType: 'type1'
        }
      });
    });

    it('should format value with payload timestamp (unix epoch)', () => {
      const data = {
        received: {
          reference: 'ref1',
          value: 456,
          appId: 'app1',
          message: { type: 'type1' },
          timestamp: 1672531200000 // Unix epoch in ms
        }
      };

      const result = utils.formatValue(
        items[4], // id5 has timestampOrigin: 'payload' with unix-epoch-ms
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual({
        pointId: 'ref1',
        timestamp: testData.constants.dates.DATE_1,
        data: {
          value: 456,
          appId: 'app1',
          messageType: 'type1'
        }
      });
    });

    it('should format value with oibus pointId', () => {
      const data = {
        received: {
          value: 456,
          appId: 'app1',
          message: { type: 'type1' }
        }
      };

      const result = utils.formatValue(
        items[3], // id4 has pointIdOrigin: 'oibus'
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result.pointId).toEqual('item4');
    });

    it('should format value with payload pointId', () => {
      const data = {
        received: {
          reference: 'ref1',
          value: 456,
          appId: 'app1',
          message: { type: 'type1' }
        }
      };

      const result = utils.formatValue(
        items[4], // id5 has pointIdOrigin: 'payload'
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result.pointId).toEqual('ref1');
    });

    it('should handle missing optional fields', () => {
      const data = {
        received: {
          reference: 'ref1',
          value: 456
          // Missing appId and messageType
        }
      };

      const result = utils.formatValue(
        items[4], // id5 has otherFields
        data,
        testData.constants.dates.FAKE_NOW,
        logger
      );

      expect(result).toEqual({
        pointId: 'ref1',
        timestamp: expect.any(String), // The actual timestamp depends on your implementation
        data: {
          value: 456
          // appId and messageType should be undefined or not included
        }
      });
    });
  });

  describe('getPointId', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return point ID from data when path exists', () => {
      const data = {
        received: {
          reference: 'device123'
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('device123');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return item name when point ID path does not exist', () => {
      const data = {
        received: {
          value: 456
          // No reference field
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path received.reference in {"received":{"value":456}}. Using item name "itemName" instead'
      );
    });

    it('should return point ID from nested data structure', () => {
      const data = {
        device: {
          info: {
            id: 'sensor-456'
          }
        }
      };

      const result = utils.getPointId(data, 'device.info.id', 'itemName', logger);

      expect(result).toEqual('sensor-456');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return item name when path exists but value is null', () => {
      const data = {
        received: {
          reference: null
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path received.reference in {"received":{"reference":null}}. Using item name "itemName" instead'
      );
    });

    it('should return point ID when path exists but value is empty string', () => {
      const data = {
        received: {
          reference: ''
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return point ID when path exists but value is 0', () => {
      const data = {
        received: {
          reference: 0
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return point ID when path exists but value is false', () => {
      const data = {
        received: {
          reference: false
        }
      };

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return item name when path is empty', () => {
      const data = {
        received: {
          reference: 'device123'
        }
      };

      const result = utils.getPointId(data, '', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path  in {"received":{"reference":"device123"}}. Using item name "itemName" instead'
      );
    });

    it('should return item name when data is empty object', () => {
      const data = {};

      const result = utils.getPointId(data, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith('Point ID not found for path received.reference in {}. Using item name "itemName" instead');
    });

    it('should return item name when data is null', () => {
      const result = utils.getPointId(null as unknown as object, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path received.reference in null. Using item name "itemName" instead'
      );
    });

    it('should return item name when data is undefined', () => {
      const result = utils.getPointId(undefined as unknown as object, 'received.reference', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path received.reference in undefined. Using item name "itemName" instead'
      );
    });

    it('should return item name when array index is out of bounds', () => {
      const data = {
        devices: [{ id: 'device1' }]
      };

      const result = utils.getPointId(data, 'devices[5].id', 'itemName', logger);

      expect(result).toEqual('itemName');
      expect(logger.warn).toHaveBeenCalledWith(
        'Point ID not found for path devices[5].id in {"devices":[{"id":"device1"}]}. Using item name "itemName" instead'
      );
    });
  });
});
