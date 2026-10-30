import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthItemSettings,
  SouthMongoDBItemSettings,
  SouthMongoDBSettings
} from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as SouthMongoDBModule from './south-mongodb';

const nodeRequire = createRequire(import.meta.url);

class MongoServerError extends Error {
  codeName?: string;
  code?: number;
  constructor(message: string, codeName?: string, code?: number) {
    super(message);
    this.name = 'MongoServerError';
    this.codeName = codeName;
    this.code = code;
  }
}

class MongoNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoNetworkError';
  }
}

class MongoServerSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoServerSelectionError';
  }
}

class ObjectId {
  private readonly hex: string;
  constructor(hex: string) {
    this.hex = hex;
  }
  toHexString(): string {
    return this.hex;
  }
}

const buildItem = (id: string, settings: SouthMongoDBItemSettings): SouthConnectorItemEntity<SouthMongoDBItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
  enabled: true,
  settings,
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

const buildConfiguration = (
  settings: Partial<SouthMongoDBSettings>,
  items: Array<SouthConnectorItemEntity<SouthMongoDBItemSettings>> = []
): SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'mongodb',
  description: 'my test connector',
  enabled: true,
  settings: {
    connectionString: 'mongodb://localhost:27017/db',
    connectionTimeout: 1000,
    username: 'username',
    password: 'password',
    ...settings
  },
  groups: [],
  items,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

describe('SouthMongoDB', () => {
  let SouthMongoDB: typeof SouthMongoDBModule.default;
  let substituteQueryPlaceholders: typeof SouthMongoDBModule.substituteQueryPlaceholders;
  let toOIBusRecord: typeof SouthMongoDBModule.toOIBusRecord;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;

  let clientConnect: Mock<() => Promise<void>>;
  let clientClose: Mock<() => Promise<void>>;
  let listCollectionsToArray: Mock<() => Promise<Array<{ name: string }>>>;
  let buildInfo: Mock<() => Promise<{ version: string }>>;
  let findToArray: Mock<() => Promise<Array<unknown>>>;
  let findSort: Mock<(spec: unknown) => unknown>;
  let collectionFind: Mock<(query: unknown) => unknown>;
  let aggregateToArray: Mock<() => Promise<Array<unknown>>>;
  let collectionAggregate: Mock<(pipeline: unknown) => unknown>;
  let dbCollection: Mock<(name: string) => unknown>;
  let MongoClient: Mock<(connectionString: string, options: unknown) => unknown>;

  const mongodbExports: Record<string, unknown> = {
    __esModule: true,
    MongoServerError,
    MongoNetworkError,
    MongoServerSelectionError,
    ObjectId
  };

  before(() => {
    mockModule(nodeRequire, 'mongodb', mongodbExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    const southMongoDBModule = reloadModule<typeof SouthMongoDBModule>(nodeRequire, './south-mongodb');
    SouthMongoDB = southMongoDBModule.default;
    substituteQueryPlaceholders = southMongoDBModule.substituteQueryPlaceholders;
    toOIBusRecord = southMongoDBModule.toOIBusRecord;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);

    clientConnect = mock.fn(async () => undefined);
    clientClose = mock.fn(async () => undefined);
    listCollectionsToArray = mock.fn(async () => [{ name: 'readings' }]);
    buildInfo = mock.fn(async () => ({ version: '7.0.0' }));
    findToArray = mock.fn(async () => []);
    findSort = mock.fn(() => ({ toArray: findToArray }));
    collectionFind = mock.fn(() => ({ sort: findSort }));
    aggregateToArray = mock.fn(async () => []);
    collectionAggregate = mock.fn(() => ({ toArray: aggregateToArray }));
    dbCollection = mock.fn(() => ({ find: collectionFind, aggregate: collectionAggregate }));
    MongoClient = mock.fn(function () {
      return {
        connect: clientConnect,
        close: clientClose,
        db: () => ({
          collection: dbCollection,
          admin: () => ({ buildInfo }),
          listCollections: () => ({ toArray: listCollectionsToArray })
        })
      };
    });
    mongodbExports.MongoClient = MongoClient;

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (configuration: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings>) =>
    new SouthMongoDB(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  describe('SouthMongoDB with authentication', () => {
    let south: SouthMongoDBModule.default;
    const configuration = buildConfiguration({}, [
      buildItem('id1', {
        collection: 'readings',
        queryType: 'find',
        query: '{"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}',
        sort: '{"timestamp": 1}',
        trackingInstant: { trackInstant: true, jsonPath: '$[*].timestamp', dateTimeInput: { type: 'timestamp' } }
      }),
      buildItem('id2', {
        collection: 'readings',
        queryType: 'aggregation',
        query: '[{"$match": {"timestamp": {"$gt": "@StartTime"}}}]',
        sort: '{"timestamp": 1}',
        trackingInstant: null
      })
    ]);

    beforeEach(() => {
      south = createSouth(configuration);
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const fetchDocumentsMock = mock.fn(async () => [
        { timestamp: new Date('2020-03-01T00:00:00.000Z'), anotherTimestamp: new Date('2023-02-01T00:00:00.000Z'), value: 456 },
        { timestamp: new Date('2020-02-01T00:00:00.000Z'), anotherTimestamp: new Date('2023-02-01T00:00:00.000Z'), value: 123 }
      ]);
      south['fetchDocuments'] = fetchDocumentsMock;

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'record-list',
        content: [
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
        ]
      });
      assert.strictEqual(fetchDocumentsMock.mock.calls.length, 1);
      assert.deepStrictEqual(fetchDocumentsMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, {
        // Tracked via item1's trackingInstant jsonPath ($[*].timestamp) over the raw (pre-flattening) docs
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
      });
      const foundLog = logger.info.mock.calls.find(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Found 2 results'));
      assert.ok(foundLog);
      assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const fetchDocumentsMock = mock.fn(async () => []);
      south['fetchDocuments'] = fetchDocumentsMock;

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.strictEqual(fetchDocumentsMock.mock.calls.length, 1);
      assert.deepStrictEqual(fetchDocumentsMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      const noResultLog = logger.debug.mock.calls.find(
        c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      );
      assert.ok(noResultLog);
      assert.deepStrictEqual(noResultLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should not track an instant when the item has no trackingInstant configured', async () => {
      const startTime = testData.constants.dates.DATE_1;
      south['fetchDocuments'] = mock.fn(async () => [{ timestamp: new Date('2020-03-01T00:00:00.000Z'), value: 456 }]);

      // item2 (aggregation) has trackingInstant: null
      const result = await south.historyQuery([configuration.items[1]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.strictEqual(result.trackedInstant, null);
    });

    it('should query data from MongoDB with a find query and sort', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      findToArray.mock.mockImplementation(async () => [{ timestamp: new Date('2020-02-01T00:00:00.000Z'), value: 123 }]);

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual(MongoClient.mock.calls.length, 1);
      assert.deepStrictEqual(MongoClient.mock.calls[0].arguments, [
        configuration.settings.connectionString,
        {
          connectTimeoutMS: configuration.settings.connectionTimeout,
          serverSelectionTimeoutMS: configuration.settings.connectionTimeout,
          auth: { username: configuration.settings.username, password: configuration.settings.password }
        }
      ]);

      assert.strictEqual(clientConnect.mock.calls.length, 1);
      assert.strictEqual(dbCollection.mock.calls.length, 1);
      assert.deepStrictEqual(dbCollection.mock.calls[0].arguments, ['readings']);

      assert.strictEqual(collectionFind.mock.calls.length, 1);
      assert.deepStrictEqual(collectionFind.mock.calls[0].arguments[0], {
        timestamp: { $gt: new Date(startTime), $lte: new Date(endTime) }
      });
      assert.strictEqual(findSort.mock.calls.length, 1);
      assert.deepStrictEqual(findSort.mock.calls[0].arguments[0], { timestamp: 1 });
      assert.strictEqual(collectionAggregate.mock.calls.length, 0);

      assert.strictEqual(clientClose.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z', value: 123 }]);
    });

    it('should query data from MongoDB with an aggregation pipeline', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      aggregateToArray.mock.mockImplementation(async () => [{ timestamp: new Date('2020-02-01T00:00:00.000Z'), value: 456 }]);

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual(dbCollection.mock.calls.length, 1);
      assert.deepStrictEqual(dbCollection.mock.calls[0].arguments, ['readings']);

      assert.strictEqual(collectionAggregate.mock.calls.length, 1);
      assert.deepStrictEqual(collectionAggregate.mock.calls[0].arguments[0], [{ $match: { timestamp: { $gt: new Date(startTime) } } }]);
      assert.strictEqual(collectionFind.mock.calls.length, 0);

      assert.strictEqual(clientClose.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z', value: 456 }]);
    });

    it('should flatten documents into OIBusRecord (ObjectId, Date, nested object/array, null)', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      findToArray.mock.mockImplementation(async () => [
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          timestamp: new Date('2020-02-01T00:00:00.000Z'),
          value: 123,
          flag: true,
          missing: null,
          nested: { a: 1 },
          list: [1, 2, 3]
        }
      ]);

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.deepStrictEqual(result, [
        {
          _id: '507f1f77bcf86cd799439011',
          timestamp: '2020-02-01T00:00:00.000Z',
          value: 123,
          flag: true,
          missing: null,
          nested: '{"a":1}',
          list: '[1,2,3]'
        }
      ]);
    });

    it('should manage query error and always close the connection', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      findToArray.mock.mockImplementation(async () => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('query error'));

      assert.strictEqual(clientConnect.mock.calls.length, 1);
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('should manage connection error without closing an unopened connection', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      MongoClient.mock.mockImplementation(function () {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));
      assert.strictEqual(clientClose.mock.calls.length, 0);
    });

    it('should test item', async () => {
      const queryDataMock = mock.method(south, 'queryData', async () => {
        mock.timers.tick(25);
        return [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ];
      });

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
      assert.deepStrictEqual(result.result, {
        type: 'record-list',
        content: [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ]
      });
    });
  });

  describe('SouthMongoDB without authentication', () => {
    let south: SouthMongoDBModule.default;
    const configuration = buildConfiguration({ username: null, password: null }, [
      buildItem('id1', {
        collection: 'readings',
        queryType: 'find',
        query: '{"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}',
        sort: '{"timestamp": 1}',
        trackingInstant: null
      })
    ]);

    beforeEach(() => {
      south = createSouth(configuration);
    });

    it('should build client options without auth when username is not set', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await south.queryData(configuration.items[0], startTime, endTime);

      assert.deepStrictEqual(MongoClient.mock.calls[0].arguments, [
        configuration.settings.connectionString,
        {
          connectTimeoutMS: configuration.settings.connectionTimeout,
          serverSelectionTimeoutMS: configuration.settings.connectionTimeout,
          auth: undefined
        }
      ]);
    });
  });

  describe('SouthMongoDB test connection', () => {
    let south: SouthMongoDBModule.default;

    beforeEach(() => {
      south = createSouth(buildConfiguration({}));
    });

    it('Database is reachable and has collections, with version', async () => {
      listCollectionsToArray.mock.mockImplementation(async () => [{ name: 'coll1' }, { name: 'coll2' }]);
      buildInfo.mock.mockImplementation(async () => ({ version: '7.0.0' }));

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Version', value: '7.0.0' },
          { key: 'Collections', value: '2' }
        ]
      });
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Database is reachable but version is unavailable', async () => {
      listCollectionsToArray.mock.mockImplementation(async () => [{ name: 'coll1' }]);
      buildInfo.mock.mockImplementation(async () => {
        throw new Error('buildInfo unavailable');
      });

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, { items: [{ key: 'Collections', value: '1' }] });
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Database has no collections', async () => {
      listCollectionsToArray.mock.mockImplementation(async () => []);

      await assert.rejects(south.testConnection(), new Error('Database has no collections'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to list collections', async () => {
      listCollectionsToArray.mock.mockImplementation(async () => {
        throw new Error('list collections error');
      });

      await assert.rejects(south.testConnection(), new Error('Unable to list collections in database. list collections error'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to connect: authentication failure', async () => {
      clientConnect.mock.mockImplementation(async () => {
        throw new MongoServerError('bad credentials', 'AuthenticationFailed', 18);
      });

      await assert.rejects(south.testConnection(), new Error('Please check username and password. bad credentials'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to connect: server selection error', async () => {
      clientConnect.mock.mockImplementation(async () => {
        throw new MongoServerSelectionError('no primary found');
      });

      await assert.rejects(south.testConnection(), new Error('Please check connection string. no primary found'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to connect: network error', async () => {
      clientConnect.mock.mockImplementation(async () => {
        throw new MongoNetworkError('connection reset');
      });

      await assert.rejects(south.testConnection(), new Error('Please check connection string. connection reset'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to connect: unexpected error', async () => {
      clientConnect.mock.mockImplementation(async () => {
        throw new Error('something unexpected');
      });

      await assert.rejects(south.testConnection(), new Error('Unexpected error. something unexpected'));
      assert.strictEqual(clientClose.mock.calls.length, 1);
    });

    it('Unable to create client: does not attempt to close an unopened connection', async () => {
      MongoClient.mock.mockImplementation(function () {
        throw new Error('unable to build client');
      });

      await assert.rejects(south.testConnection(), new Error('Unexpected error. unable to build client'));
      assert.strictEqual(clientClose.mock.calls.length, 0);
    });
  });

  describe('substituteQueryPlaceholders', () => {
    it('should substitute @StartTime and @EndTime with Date instances for an object query', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      const result = substituteQueryPlaceholders('{"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}', startTime, endTime);

      assert.deepStrictEqual(result, { timestamp: { $gt: new Date(startTime), $lte: new Date(endTime) } });
    });

    it('should substitute placeholders inside an aggregation pipeline array', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      const result = substituteQueryPlaceholders(
        '[{"$match": {"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}}, {"$sort": {"timestamp": 1}}]',
        startTime,
        endTime
      );

      assert.deepStrictEqual(result, [
        { $match: { timestamp: { $gt: new Date(startTime), $lte: new Date(endTime) } } },
        { $sort: { timestamp: 1 } }
      ]);
    });

    it('should leave a query without placeholders unchanged (aside from parsing)', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      const result = substituteQueryPlaceholders('{"value": {"$gt": 10}}', startTime, endTime);

      assert.deepStrictEqual(result, { value: { $gt: 10 } });
    });
  });

  describe('toOIBusRecord', () => {
    it('should flatten a document with mixed field types', () => {
      const doc = {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        timestamp: new Date('2020-02-01T00:00:00.000Z'),
        stringValue: 'hello',
        numberValue: 42,
        booleanValue: false,
        nullValue: null,
        undefinedValue: undefined,
        nestedObject: { a: 1, b: 'two' },
        arrayValue: [1, 2, 3]
      };

      assert.deepStrictEqual(toOIBusRecord(doc), {
        _id: '507f1f77bcf86cd799439011',
        timestamp: '2020-02-01T00:00:00.000Z',
        stringValue: 'hello',
        numberValue: 42,
        booleanValue: false,
        nullValue: null,
        undefinedValue: null,
        nestedObject: '{"a":1,"b":"two"}',
        arrayValue: '[1,2,3]'
      });
    });
  });

  describe('trackMaxInstant', () => {
    let south: SouthMongoDBModule.default;
    const baseItem = buildItem('id1', { collection: 'readings', queryType: 'find', query: '{}', sort: '{}', trackingInstant: null });
    const withTracking = (jsonPath: string, type: 'timestamp' | 'unix-epoch-ms', sort = baseItem.settings.sort) => ({
      ...baseItem,
      settings: { ...baseItem.settings, sort, trackingInstant: { trackInstant: true, jsonPath, dateTimeInput: { type } } }
    });

    beforeEach(() => {
      south = createSouth(buildConfiguration({ username: null, password: null }));
    });

    it('should return null when trackInstant is false', () => {
      const item = { ...baseItem, settings: { ...baseItem.settings, trackingInstant: null } };
      const result = south['trackMaxInstant'](item, [{ timestamp: new Date('2020-01-01T00:00:00.000Z') }]);
      assert.strictEqual(result, null);
    });

    it('should reach a nested field via jsonPath across multiple documents', () => {
      const docs = [
        { metadata: { recordedAt: new Date('2020-01-01T00:00:00.000Z') } },
        { metadata: { recordedAt: new Date('2020-06-01T00:00:00.000Z') } }
      ];
      assert.strictEqual(south['trackMaxInstant'](withTracking('$[*].metadata.recordedAt', 'timestamp'), docs), '2020-06-01T00:00:00.000Z');
    });

    it('should convert unix-epoch-ms values before comparing (not lexicographic string comparison)', () => {
      // 999999999 < 1000000000 numerically, but "999999999" > "1000000000" lexicographically as strings
      const docs = [{ epoch: 1000000000 }, { epoch: 999999999 }];
      assert.strictEqual(south['trackMaxInstant'](withTracking('$[*].epoch', 'unix-epoch-ms'), docs), new Date(1000000000).toISOString());
    });

    it('should return null when the jsonPath finds no matches', () => {
      assert.strictEqual(south['trackMaxInstant'](withTracking('$[*].doesNotExist', 'timestamp'), [{ timestamp: new Date() }]), null);
    });

    it('should track correctly even when sort is empty, proving sort and tracking are decoupled', () => {
      const docs = [{ timestamp: new Date('2020-01-01T00:00:00.000Z') }, { timestamp: new Date('2020-02-01T00:00:00.000Z') }];
      assert.strictEqual(south['trackMaxInstant'](withTracking('$[*].timestamp', 'timestamp', '{}'), docs), '2020-02-01T00:00:00.000Z');
    });
  });
});
