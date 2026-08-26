import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { SouthItemSettings } from '../../../shared/model/south-settings.model';
import type { SouthMongoDBItemSettings, SouthMongoDBSettings } from '../../../shared/model/south-settings.model';
import type SouthMongoDBClass from './south-mongodb';
import type { substituteQueryPlaceholders as substituteQueryPlaceholdersType, toOIBusRecord as toOIBusRecordType } from './south-mongodb';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

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

describe('SouthMongoDB', () => {
  let SouthMongoDB: typeof SouthMongoDBClass;
  let substituteQueryPlaceholders: typeof substituteQueryPlaceholdersType;
  let toOIBusRecord: typeof toOIBusRecordType;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const clientConnect = mock.fn(async () => undefined);
  const clientClose = mock.fn(async () => undefined);

  const listCollectionsToArray = mock.fn(async () => [{ name: 'readings' }]);
  const dbListCollections = mock.fn(() => ({ toArray: listCollectionsToArray }));
  const buildInfo = mock.fn(async () => ({ version: '7.0.0' }));
  const dbAdmin = mock.fn(() => ({ buildInfo }));

  const findToArray = mock.fn(async (): Promise<Array<unknown>> => []);
  const findSort = mock.fn((_spec: unknown) => ({ toArray: findToArray }));
  const collectionFind = mock.fn((_query: unknown) => ({ sort: findSort }));
  const aggregateToArray = mock.fn(async (): Promise<Array<unknown>> => []);
  const collectionAggregate = mock.fn((_pipeline: unknown) => ({ toArray: aggregateToArray }));
  const dbCollection = mock.fn((_name: string) => ({ find: collectionFind, aggregate: collectionAggregate }));

  const clientDb = mock.fn(() => ({ collection: dbCollection, admin: dbAdmin, listCollections: dbListCollections }));

  const mongodbExports: Record<string, unknown> = {
    __esModule: true,
    MongoClient: mock.fn(function (_connectionString: string, _options: unknown) {
      return { connect: clientConnect, close: clientClose, db: clientDb };
    }),
    MongoServerError,
    MongoNetworkError,
    MongoServerSelectionError,
    ObjectId
  };

  const utilsExports = {
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items]),
    // Mirrors the real implementation in service/utils.ts for the DateTimeType variants this connector
    // actually uses ('timestamp' for native BSON Date fields, plus the epoch/iso-string variants).
    convertDateTimeToInstant: mock.fn((dateTime: unknown, options: { type?: string }) => {
      if (dateTime === null || dateTime === undefined) return '';
      switch (options.type) {
        case 'timestamp':
          return (dateTime as Date).toISOString();
        case 'unix-epoch':
          return new Date((dateTime as number) * 1000).toISOString();
        case 'unix-epoch-ms':
          return new Date(dateTime as number).toISOString();
        case 'iso-string':
          return new Date(dateTime as string).toISOString();
        default:
          return String(dateTime);
      }
    }),
    getErrorMessage: mock.fn((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      return String(error);
    }),
    // Mirrors the real implementation in service/utils.ts — kept in sync manually since it's a
    // handful of lines and some tests assert the exact { itemId/itemName } / { groupId/groupName } shape.
    workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
      if (items.length === 0) return {};
      if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
      const lead = items[0];
      return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
    })
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'mongodb', mongodbExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    const southMongoDBModule = reloadModule<{
      default: typeof SouthMongoDBClass;
      substituteQueryPlaceholders: typeof substituteQueryPlaceholdersType;
      toOIBusRecord: typeof toOIBusRecordType;
    }>(nodeRequire, './south-mongodb');
    SouthMongoDB = southMongoDBModule.default;
    substituteQueryPlaceholders = southMongoDBModule.substituteQueryPlaceholders;
    toOIBusRecord = southMongoDBModule.toOIBusRecord;
  });

  beforeEach(() => {
    clientConnect.mock.resetCalls();
    clientClose.mock.resetCalls();
    listCollectionsToArray.mock.resetCalls();
    dbListCollections.mock.resetCalls();
    buildInfo.mock.resetCalls();
    dbAdmin.mock.resetCalls();
    findToArray.mock.resetCalls();
    findSort.mock.resetCalls();
    collectionFind.mock.resetCalls();
    aggregateToArray.mock.resetCalls();
    collectionAggregate.mock.resetCalls();
    dbCollection.mock.resetCalls();
    clientDb.mock.resetCalls();
    addContentCallback.mock.resetCalls();

    clientConnect.mock.mockImplementation(async () => undefined);
    clientClose.mock.mockImplementation(async () => undefined);
    listCollectionsToArray.mock.mockImplementation(async () => [{ name: 'readings' }]);
    buildInfo.mock.mockImplementation(async () => ({ version: '7.0.0' }));
    findToArray.mock.mockImplementation(async () => []);
    aggregateToArray.mock.mockImplementation(async () => []);

    mongodbExports.MongoClient = mock.fn(function () {
      return { connect: clientConnect, close: clientClose, db: clientDb };
    });

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthMongoDB with authentication', () => {
    let south: SouthMongoDBClass;
    const configuration: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mongodb',
      description: 'my test connector',
      enabled: true,
      settings: {
        connectionString: 'mongodb://localhost:27017/db',
        connectionTimeout: 1000,
        username: 'username',
        password: 'password'
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            collection: 'readings',
            queryType: 'find',
            query: '{"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}',
            sort: '{"timestamp": 1}',
            trackingInstant: { trackInstant: true, jsonPath: '$[*].timestamp', dateTimeInput: { type: 'timestamp' } }
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          startTimeOffset: 0,
          endTimeOffset: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'id2',
          name: 'item2',
          enabled: true,
          settings: {
            collection: 'readings',
            queryType: 'aggregation',
            query: '[{"$match": {"timestamp": {"$gt": "@StartTime"}}}]',
            sort: '{"timestamp": 1}',
            trackingInstant: null
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          startTimeOffset: 0,
          endTimeOffset: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMongoDB(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const fetchDocumentsMock = mock.method(
        south as unknown as { fetchDocuments: (...args: Array<unknown>) => Promise<Array<unknown>> },
        'fetchDocuments',
        mock.fn(async () => [
          { timestamp: new Date('2020-03-01T00:00:00.000Z'), anotherTimestamp: new Date('2023-02-01T00:00:00.000Z'), value: 456 },
          { timestamp: new Date('2020-02-01T00:00:00.000Z'), anotherTimestamp: new Date('2023-02-01T00:00:00.000Z'), value: 123 }
        ])
      );

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
      const foundLog = logger.info.mock.calls.find(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Found 2 results')
      );
      assert.ok(foundLog);
      assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const fetchDocumentsMock = mock.method(
        south as unknown as { fetchDocuments: (...args: Array<unknown>) => Promise<Array<unknown>> },
        'fetchDocuments',
        mock.fn(async () => [])
      );

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
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      );
      assert.ok(noResultLog);
      assert.deepStrictEqual(noResultLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should not track an instant when the item has no trackingInstant configured', async () => {
      const startTime = testData.constants.dates.DATE_1;
      mock.method(
        south as unknown as { fetchDocuments: (...args: Array<unknown>) => Promise<Array<unknown>> },
        'fetchDocuments',
        mock.fn(async () => [{ timestamp: new Date('2020-03-01T00:00:00.000Z'), value: 456 }])
      );

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

      assert.strictEqual((mongodbExports.MongoClient as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((mongodbExports.MongoClient as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
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

      mongodbExports.MongoClient = mock.fn(function () {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));
      assert.strictEqual(clientClose.mock.calls.length, 0);
    });

    it('should test item', async () => {
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => {
          mock.timers.tick(25);
          return [
            { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
            { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
          ];
        })
      );

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
    let south: SouthMongoDBClass;
    const configuration: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mongodb',
      description: 'my test connector',
      enabled: true,
      settings: {
        connectionString: 'mongodb://localhost:27017/db',
        connectionTimeout: 1000,
        username: null,
        password: null
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            collection: 'readings',
            queryType: 'find',
            query: '{"timestamp": {"$gt": "@StartTime", "$lte": "@EndTime"}}',
            sort: '{"timestamp": 1}',
            trackingInstant: null
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          startTimeOffset: 0,
          endTimeOffset: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMongoDB(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should build client options without auth when username is not set', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await south.queryData(configuration.items[0], startTime, endTime);

      assert.deepStrictEqual((mongodbExports.MongoClient as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
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
    let south: SouthMongoDBClass;
    const configuration: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mongodb',
      description: 'my test connector',
      enabled: true,
      settings: {
        connectionString: 'mongodb://localhost:27017/db',
        connectionTimeout: 1000,
        username: 'username',
        password: 'password'
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMongoDB(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
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
      mongodbExports.MongoClient = mock.fn(function () {
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
    let south: SouthMongoDBClass;
    const baseConfiguration: SouthConnectorEntity<SouthMongoDBSettings, SouthMongoDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mongodb',
      description: 'my test connector',
      enabled: true,
      settings: {
        connectionString: 'mongodb://localhost:27017/db',
        connectionTimeout: 1000,
        username: null,
        password: null
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const baseItem: SouthConnectorItemEntity<SouthMongoDBItemSettings> = {
      id: 'id1',
      name: 'item1',
      enabled: true,
      settings: {
        collection: 'readings',
        queryType: 'find',
        query: '{}',
        sort: '{}',
        trackingInstant: null
      },
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 0,
      startTimeOffset: 0,
      endTimeOffset: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    function callTrackMaxInstant(item: SouthConnectorItemEntity<SouthMongoDBItemSettings>, docs: Array<unknown>): string | null {
      return (south as unknown as { trackMaxInstant: (i: unknown, d: Array<unknown>) => string | null }).trackMaxInstant(item, docs);
    }

    beforeEach(() => {
      south = new SouthMongoDB(baseConfiguration, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should return null when trackInstant is false', () => {
      const item = { ...baseItem, settings: { ...baseItem.settings, trackingInstant: null } };
      const result = callTrackMaxInstant(item, [{ timestamp: new Date('2020-01-01T00:00:00.000Z') }]);
      assert.strictEqual(result, null);
    });

    it('should reach a nested field via jsonPath across multiple documents', () => {
      const item = {
        ...baseItem,
        settings: {
          ...baseItem.settings,
          trackingInstant: { trackInstant: true, jsonPath: '$[*].metadata.recordedAt', dateTimeInput: { type: 'timestamp' as const } }
        }
      };
      const docs = [
        { metadata: { recordedAt: new Date('2020-01-01T00:00:00.000Z') } },
        { metadata: { recordedAt: new Date('2020-06-01T00:00:00.000Z') } }
      ];
      assert.strictEqual(callTrackMaxInstant(item, docs), '2020-06-01T00:00:00.000Z');
    });

    it('should convert unix-epoch-ms values before comparing (not lexicographic string comparison)', () => {
      const item = {
        ...baseItem,
        settings: {
          ...baseItem.settings,
          trackingInstant: { trackInstant: true, jsonPath: '$[*].epoch', dateTimeInput: { type: 'unix-epoch-ms' as const } }
        }
      };
      // 999999999 < 1000000000 numerically, but "999999999" > "1000000000" lexicographically as strings
      const docs = [{ epoch: 1000000000 }, { epoch: 999999999 }];
      assert.strictEqual(callTrackMaxInstant(item, docs), new Date(1000000000).toISOString());
    });

    it('should return null when the jsonPath finds no matches', () => {
      const item = {
        ...baseItem,
        settings: {
          ...baseItem.settings,
          trackingInstant: { trackInstant: true, jsonPath: '$[*].doesNotExist', dateTimeInput: { type: 'timestamp' as const } }
        }
      };
      assert.strictEqual(callTrackMaxInstant(item, [{ timestamp: new Date() }]), null);
    });

    it('should track correctly even when sort is empty, proving sort and tracking are decoupled', () => {
      const item = {
        ...baseItem,
        settings: {
          ...baseItem.settings,
          sort: '{}',
          trackingInstant: { trackInstant: true, jsonPath: '$[*].timestamp', dateTimeInput: { type: 'timestamp' as const } }
        }
      };
      const docs = [{ timestamp: new Date('2020-01-01T00:00:00.000Z') }, { timestamp: new Date('2020-02-01T00:00:00.000Z') }];
      assert.strictEqual(callTrackMaxInstant(item, docs), '2020-02-01T00:00:00.000Z');
    });
  });
});
