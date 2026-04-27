import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type {
  SouthMySQLItemSettings,
  SouthMySQLItemSettingsDateTimeFields,
  SouthMySQLSettings
} from '../../../shared/model/south-settings.model';
import type SouthMySQLClass from './south-mysql';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

// Error codes handled by the test function
const ERROR_CODES = {
  ETIMEDOUT: 'Please check host and port.',
  ECONNREFUSED: 'Please check host and port.',
  ER_ACCESS_DENIED_ERROR: 'Please check username and password.',
  ER_DBACCESS_DENIED_ERROR: `User "username" does not have access to database "db".`,
  ER_BAD_DB_ERROR: `Database "db" does not exist.`,
  DEFAULT: 'Unexpected error.'
} as const;
type ErrorCodes = keyof typeof ERROR_CODES;

class MYSQL2Error extends Error {
  constructor(
    message: string,
    private code: string
  ) {
    super();
    this.name = 'MYSQL2Error';
    this.message = message;
    this.code = code;
  }
}

describe('SouthMySQL', () => {
  let SouthMySQL: typeof SouthMySQLClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const mysqlExports: Record<string, unknown> = {
    __esModule: true,
    createConnection: mock.fn(async () => ({
      end: mock.fn(),
      execute: mock.fn(),
      ping: mock.fn()
    }))
  };
  mysqlExports.default = mysqlExports;

  const utilsExports = {
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn(() => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'mysql2/promise', mysqlExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthMySQL = reloadModule<{ default: typeof SouthMySQLClass }>(nodeRequire, './south-mysql').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();
    mysqlExports.createConnection = mock.fn(async () => ({
      end: mock.fn(),
      execute: mock.fn(),
      ping: mock.fn()
    }));
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.generateCsvContent = mock.fn(() => '');
    utilsExports.generateFilenameForSerialization = mock.fn(() => 'filename.csv');
    utilsExports.generateReplacementParameters = mock.fn(() => []);
    utilsExports.logQuery = mock.fn();
    utilsExports.persistResults = mock.fn(async () => undefined);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthMySQL with authentication', () => {
    let south: SouthMySQLClass;
    const configuration: SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mysql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 3306,
        database: 'db',
        username: 'username',
        password: 'password',
        connectionTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMySQLItemSettingsDateTimeFields,
              {
                fieldName: 'timestamp',
                useAsReference: true,
                type: 'string',
                timezone: 'Europe/Paris',
                format: 'yyyy-MM-dd HH:mm:ss.SSS',
                locale: 'en-US'
              }
            ],
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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
            query: 'query2',
            requestTimeout: 1000,
            dateTimeFields: null,
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMySQLItemSettingsDateTimeFields,
              {
                fieldName: 'timestamp',
                useAsReference: true,
                type: 'string',
                timezone: 'Europe/Paris',
                format: 'yyyy-MM-dd HH:mm:ss.SSS',
                locale: 'en-US'
              }
            ],
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[1],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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
      south = new SouthMySQL(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => '2020-02-01 00:00:00.000');
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual((utilsExports.persistResults as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
      });
      assert.ok(
        logger.info.mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('Found 2 results') && (c.arguments[0] as string).includes(configuration.items[0].name)
        )
      );
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual((utilsExports.persistResults as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('No result found') && (c.arguments[0] as string).includes(configuration.items[0].name)
        )
      );
    });

    it('should get data from MySQL', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      let formatCallCount = 0;
      utilsExports.formatInstant = mock.fn(() => {
        formatCallCount++;
        if (formatCallCount === 1) return startTime;
        if (formatCallCount === 2) return endTime;
        return startTime;
      });

      utilsExports.generateReplacementParameters = mock.fn(() => ({ startTime, endTime }));

      const mockExecute = mock.fn(async () => [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]);
      const mockEnd = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ end: mockEnd, execute: mockExecute, ping: mock.fn() }));

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[0].settings.query
      );

      assert.strictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        user: configuration.settings.username,
        password: configuration.settings.password,
        database: configuration.settings.database,
        connectTimeout: configuration.settings.connectionTimeout,
        timezone: 'Z'
      });

      assert.strictEqual(mockExecute.mock.calls.length, 1);
      assert.deepStrictEqual(mockExecute.mock.calls[0].arguments[0], {
        sql: configuration.items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        values: { startTime, endTime },
        timeout: configuration.items[0].settings.requestTimeout
      });
      assert.strictEqual(mockEnd.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should get data from MySQL without reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const mockExecute = mock.fn(async () => [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]);
      const mockEnd = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ end: mockEnd, execute: mockExecute, ping: mock.fn() }));

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[1].settings.query
      );

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters = mock.fn(() => ({ startTime, endTime }));

      const mockExecute = mock.fn(() => {
        throw new Error('query error');
      });
      const mockEnd = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ end: mockEnd, execute: mockExecute, ping: mock.fn() }));

      let error: unknown;
      try {
        await south.queryData(configuration.items[0], startTime, endTime);
      } catch (err) {
        error = err;
      }

      assert.strictEqual(mockExecute.mock.calls.length, 1);
      assert.deepStrictEqual(mockExecute.mock.calls[0].arguments[0], {
        sql: configuration.items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        values: { startTime, endTime },
        timeout: configuration.items[0].settings.requestTimeout
      });
      assert.deepStrictEqual(error, new Error('query error'));
      assert.strictEqual(mockEnd.mock.calls.length, 1);
    });

    it('should test item', async () => {
      const mockEnd = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({
        end: mockEnd,
        execute: mock.fn(async () => [
          [{ timestamp: '2020-02-01T00:00:00.000Z', table_count: 2 }, { timestamp: '2020-03-01T00:00:00.000Z' }]
        ]),
        ping: mock.fn()
      }));

      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );

      const formattedInstant = '2020-01-01T00:00:00.000Z';
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      mock.method(
        south,
        'createConnectionOptions',
        mock.fn(async () => undefined)
      );

      await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      assert.strictEqual((south.createConnectionOptions as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    });

    it('should test item without datetimeFields', async () => {
      const mockEnd = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({
        end: mockEnd,
        execute: mock.fn(async () => [
          [{ timestamp: '2020-02-01T00:00:00.000Z', table_count: 2 }, { timestamp: '2020-03-01T00:00:00.000Z' }]
        ])
      }));

      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );

      const formattedInstant = '2020-01-01T00:00:00.000Z';
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      mock.method(
        south,
        'createConnectionOptions',
        mock.fn(async () => undefined)
      );

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      assert.strictEqual((south.createConnectionOptions as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    });
  });

  describe('SouthMySQL without authentication', () => {
    let south: SouthMySQLClass;
    const configuration: SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mysql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 3306,
        database: 'db',
        username: null,
        password: null,
        connectionTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMySQLItemSettingsDateTimeFields,
              {
                fieldName: 'timestamp',
                useAsReference: true,
                type: 'string',
                timezone: 'Europe/Paris',
                format: 'yyyy-MM-dd HH:mm:ss.SSS',
                locale: 'en-US'
              }
            ],
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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
            query: 'query2',
            requestTimeout: 1000,
            dateTimeFields: null,
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMySQLItemSettingsDateTimeFields,
              {
                fieldName: 'timestamp',
                useAsReference: true,
                type: 'string',
                timezone: 'Europe/Paris',
                format: 'yyyy-MM-dd HH:mm:ss.SSS',
                locale: 'en-US'
              }
            ],
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[1],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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
      south = new SouthMySQL(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      mysqlExports.createConnection = mock.fn(() => {
        throw new Error('connection error');
      });

      let error: unknown;
      try {
        await south.queryData(configuration.items[0], startTime, endTime);
      } catch (err) {
        error = err;
      }

      assert.strictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((mysqlExports.createConnection as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        user: undefined,
        password: undefined,
        database: configuration.settings.database,
        connectTimeout: configuration.settings.connectionTimeout,
        timezone: 'Z'
      });
      assert.deepStrictEqual(error, new Error('connection error'));
    });
  });

  describe('SouthMySQL test connection', () => {
    let south: SouthMySQLClass;
    const configuration: SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mysql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 3306,
        database: 'db',
        username: 'username',
        password: 'password',
        connectionTimeout: 1000
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMySQL(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let executeCallCount = 0;
      const mockExecute = mock.fn(async () => {
        executeCallCount++;
        if (executeCallCount === 1) return [[{ table_count: 21 }]];
        return [[{ version: '8.0.32' }]];
      });
      const mockEnd = mock.fn();
      const mockPing = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ execute: mockExecute, ping: mockPing, end: mockEnd }));

      const testResult = await south.testConnection();

      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Version', value: '8.0.32' },
          { key: 'Tables', value: '21' }
        ]
      });
      assert.ok(mockEnd.mock.calls.length > 0);
    });

    it('Database is reachable but version is unavailable', async () => {
      let executeCallCount = 0;
      const mockExecute = mock.fn(async () => {
        executeCallCount++;
        if (executeCallCount === 1) return [[{ table_count: 5 }]];
        return [[{}]]; // no version key
      });
      const mockEnd = mock.fn();
      const mockPing = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ execute: mockExecute, ping: mockPing, end: mockEnd }));

      const testResult = await south.testConnection();

      assert.deepStrictEqual(testResult, { items: [{ key: 'Tables', value: '5' }] });
      assert.ok(mockEnd.mock.calls.length > 0);
    });

    it('Unable to create connection', async () => {
      const errorMessage = 'Error creating connection';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        mysqlExports.createConnection = mock.fn(() => {
          throw new MYSQL2Error(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('Unable to ping database', async () => {
      const errorMessage = 'Error pinging database';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        const mockEnd = mock.fn();
        mysqlExports.createConnection = mock.fn(async () => ({
          ping: () => {
            throw new MYSQL2Error(errorMessage, code);
          },
          end: mockEnd
        }));
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
        assert.ok(mockEnd.mock.calls.length > 0);
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'information_schema.TABLES does not exist';
      const mockExecute = mock.fn(() => {
        throw new Error(errorMessage);
      });
      const mockEnd = mock.fn();
      const mockPing = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ execute: mockExecute, ping: mockPing, end: mockEnd }));

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
      );
      assert.ok(mockEnd.mock.calls.length > 0);
    });

    it('Database has no tables', async () => {
      const mockExecute = mock.fn(async () => [[{ table_count: 0 }]]);
      const mockEnd = mock.fn();
      const mockPing = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ execute: mockExecute, ping: mockPing, end: mockEnd }));

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(mockEnd.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      const mockExecute = mock.fn(async () => [[]]);
      const mockEnd = mock.fn();
      const mockPing = mock.fn();
      mysqlExports.createConnection = mock.fn(async () => ({ execute: mockExecute, ping: mockPing, end: mockEnd }));

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(mockEnd.mock.calls.length > 0);
    });

    it('Unable to ping database without password', async () => {
      const savedPassword = configuration.settings.password;
      configuration.settings.password = '';
      const errorMessage = 'Error pinging database';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        const mockEnd = mock.fn();
        mysqlExports.createConnection = mock.fn(async () => ({
          ping: () => {
            throw new MYSQL2Error(errorMessage, code);
          },
          end: mockEnd
        }));
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }

      configuration.settings.password = savedPassword;
    });
  });
});
