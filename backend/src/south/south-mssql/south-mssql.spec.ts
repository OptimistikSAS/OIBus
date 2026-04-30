import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type {
  SouthMSSQLItemSettings,
  SouthMSSQLItemSettingsDateTimeFields,
  SouthMSSQLSettings
} from '../../../shared/model/south-settings.model';
import type SouthMSSQLClass from './south-mssql';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

// Error codes handled by the test function
const ERROR_CODES = {
  ETIMEOUT: 'Please check host and port.',
  ESOCKET: 'Please check host and port.',
  ELOGIN: 'Please check username, password and database name.',
  DEFAULT: 'Unable to connect to database.'
} as const;
type ErrorCodes = keyof typeof ERROR_CODES;

class MSSQLError extends Error {
  constructor(
    message: string,
    private code: string
  ) {
    super();
    this.name = 'MSSQLError';
    this.message = message;
    this.code = code;
  }
}

describe('SouthMSSQL', () => {
  let SouthMSSQL: typeof SouthMSSQLClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const query = mock.fn(() => ({
    recordsets: [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]
  }));
  const input = mock.fn();
  const close = mock.fn();
  const request = mock.fn(() => ({ input, query }));
  const connect = mock.fn(() => ({ request, close }));

  const mssqlExports: Record<string, unknown> = {
    __esModule: true,
    ConnectionPool: mock.fn(function () {
      return { connect };
    })
  };
  mssqlExports.default = mssqlExports;

  const utilsExports = {
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    convertDelimiter: mock.fn((d: unknown) => d),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn(() => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'mssql', mssqlExports);
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
    SouthMSSQL = reloadModule<{ default: typeof SouthMSSQLClass }>(nodeRequire, './south-mssql').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    query.mock.resetCalls();
    input.mock.resetCalls();
    close.mock.resetCalls();
    request.mock.resetCalls();
    connect.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    mssqlExports.ConnectionPool = mock.fn(function () {
      return { connect };
    });
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.generateCsvContent = mock.fn(() => '');
    utilsExports.generateFilenameForSerialization = mock.fn(() => 'filename.csv');
    utilsExports.persistResults = mock.fn(async () => undefined);
    utilsExports.logQuery = mock.fn();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthMSSQL with authentication', () => {
    let south: SouthMSSQLClass;
    const configuration: SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mssql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 1433,
        database: 'db',
        username: 'username',
        password: 'password',
        domain: 'domain',
        encryption: false,
        connectionTimeout: 1000,
        requestTimeout: 1000,
        trustServerCertificate: true
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: '',
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: '',
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMSSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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

    it('should get data from MSSQL', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const endTime = '2022-01-01T00:00:00.000Z';

      let formatCallCount = 0;
      utilsExports.formatInstant = mock.fn(() => {
        formatCallCount++;
        if (formatCallCount === 1) return '2020-01-01 00:00:00.000';
        if (formatCallCount === 2) return '2022-01-01 00:00:00.000';
        return startTime;
      });

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 2);
      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[0].settings.query
      );

      assert.strictEqual((mssqlExports.ConnectionPool as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((mssqlExports.ConnectionPool as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        user: configuration.settings.username,
        password: 'password',
        server: configuration.settings.host,
        port: configuration.settings.port,
        database: configuration.settings.database,
        connectionTimeout: configuration.settings.connectionTimeout,
        requestTimeout: configuration.settings.requestTimeout,
        options: {
          trustServerCertificate: configuration.settings.trustServerCertificate,
          encrypt: configuration.settings.encryption,
          useUTC: true
        },
        domain: configuration.settings.domain
      });
      assert.ok(input.mock.calls.some(c => c.arguments[0] === 'StartTime' && c.arguments[1] === '2020-01-01 00:00:00.000'));
      assert.ok(input.mock.calls.some(c => c.arguments[0] === 'EndTime' && c.arguments[1] === '2022-01-01 00:00:00.000'));
      assert.ok(query.mock.calls.some(c => c.arguments[0] === configuration.items[0].settings.query));
      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should test item', async () => {
      const formattedInstant = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    });

    it('should test item without datetimeFields', async () => {
      const formattedInstant = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    });
  });

  describe('SouthMSSQL without authentication', () => {
    let south: SouthMSSQLClass;
    const configuration: SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mssql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 1433,
        database: 'db',
        username: null,
        password: null,
        domain: null,
        encryption: false,
        connectionTimeout: 1000,
        requestTimeout: 1000,
        trustServerCertificate: true
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: '',
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
      south = new SouthMSSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should manage query error', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const endTime = '2022-01-01T00:00:00.000Z';

      query.mock.resetCalls();
      query.mock.mockImplementationOnce(() => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[1], startTime, endTime), new Error('query error'));
      assert.deepStrictEqual((mssqlExports.ConnectionPool as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        user: undefined,
        password: undefined,
        server: configuration.settings.host,
        port: configuration.settings.port,
        database: configuration.settings.database,
        connectionTimeout: configuration.settings.connectionTimeout,
        requestTimeout: configuration.settings.requestTimeout,
        options: {
          encrypt: configuration.settings.encryption,
          trustServerCertificate: configuration.settings.trustServerCertificate,
          useUTC: true
        }
      });
      assert.ok(query.mock.calls.some(c => c.arguments[0] === configuration.items[1].settings.query));
      assert.strictEqual(input.mock.calls.length, 0);
      assert.strictEqual(close.mock.calls.length, 1);
    });
  });

  describe('SouthMSSQL test connection', () => {
    let south: SouthMSSQLClass;
    const configuration: SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'mssql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 1433,
        database: 'db',
        username: 'username',
        password: 'password',
        domain: 'domain',
        encryption: false,
        connectionTimeout: 1000,
        requestTimeout: 1000,
        trustServerCertificate: true
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthMSSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let queryCallCount = 0;
      query.mock.resetCalls();
      query.mock.mockImplementation(() => {
        queryCallCount++;
        if (queryCallCount === 1) return { recordsets: [[{ table_count: 21 }]] };
        return { recordsets: [[{ version: 'Microsoft SQL Server 2019\n(RTM)' }]] };
      });

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Version', value: 'Microsoft SQL Server 2019' },
          { key: 'Tables', value: '21' }
        ]
      });
      assert.ok(close.mock.calls.length > 0);
    });

    it('Database is reachable but version is unavailable', async () => {
      let queryCallCount = 0;
      query.mock.resetCalls();
      query.mock.mockImplementation(() => {
        queryCallCount++;
        if (queryCallCount === 1) return { recordsets: [[{ table_count: 5 }]] };
        return { recordsets: [[{}]] };
      });

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, { items: [{ key: 'Tables', value: '5' }] });
      assert.ok(close.mock.calls.length > 0);
    });

    it('Unable to create connection pool', async () => {
      const errorMessage = 'Error creating connection pool';
      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        close.mock.resetCalls();
        mssqlExports.ConnectionPool = mock.fn(function () {
          throw new MSSQLError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'INFORMATION_SCHEMA.TABLES does not exist';
      query.mock.resetCalls();
      query.mock.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
      );
      assert.ok(close.mock.calls.length > 0);
    });

    it('Database has no tables', async () => {
      query.mock.resetCalls();
      query.mock.mockImplementation(() => ({ recordsets: [[{ table_count: 0 }]] }));
      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      query.mock.resetCalls();
      query.mock.mockImplementation(() => ({ recordsets: [[]] }));
      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Unable to connect to database without password', async () => {
      const errorMessage = 'Error connecting to database';
      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        close.mock.resetCalls();
        connect.mock.resetCalls();
        connect.mock.mockImplementationOnce(() => {
          throw new MSSQLError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });
  });
});
