import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type {
  SouthODBCItemSettings,
  SouthODBCItemSettingsDateTimeFields,
  SouthODBCSettings
} from '../../../shared/model/south-settings.model';
import type SouthODBCClass from './south-odbc';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

// Loose type alias for mock odbc instances returned by loadOdbc
type OdbcMockInstance = { connect: (args: unknown) => unknown } | null;

const nodeRequire = createRequire(import.meta.url);

describe('SouthODBC', () => {
  let SouthODBC: typeof SouthODBCClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const utilsExports = {
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    convertDelimiter: mock.fn((d: unknown) => d),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn(() => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(
      async (_data: unknown, _serialization: unknown, _name: string, _item: unknown, _instant: unknown, _folder: string) => undefined
    )
  };

  const odbcLoaderExports = {
    loadOdbc: mock.fn((): OdbcMockInstance => null)
  };

  const httpRequestExports = {
    __esModule: true,
    HTTPRequest: mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200, {}))
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, './odbc-loader', odbcLoaderExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
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
    SouthODBC = reloadModule<{ default: typeof SouthODBCClass }>(nodeRequire, './south-odbc').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();

    // Reset utils mocks
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.convertDelimiter = mock.fn((d: unknown) => d);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.generateCsvContent = mock.fn(() => '');
    utilsExports.generateFilenameForSerialization = mock.fn(() => 'filename.csv');
    utilsExports.logQuery = mock.fn();
    utilsExports.persistResults = mock.fn(
      async (_data: unknown, _serialization: unknown, _name: string, _item: unknown, _instant: unknown, _folder: string) => undefined
    );

    // Reset other mocks
    odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => null);
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200, {}));

    // Reset logger mocks
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      fn.mock.resetCalls();
    }

    mock.method(console, 'info', () => null);
    mock.method(console, 'error', () => null);

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  // Shared configuration for "with authentication" describe blocks
  const configurationWithAuth: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthODBCItemSettingsDateTimeFields,
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
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthODBCItemSettingsDateTimeFields,
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

  describe('SouthODBC odbc driver with authentication', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = JSON.parse(JSON.stringify(configurationWithAuth));

    beforeEach(() => {
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should do nothing on connect and disconnect', async () => {
      await south.connect();
      await south.disconnect();
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 0);
    });

    it('should not add ; if present', async () => {
      const settingsCopy = JSON.parse(JSON.stringify(south.connectorConfiguration.settings));
      settingsCopy.connectionString += ';';
      const result = await south.createConnectionConfig(settingsCopy);
      assert.deepStrictEqual(result, {
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;PWD=password;',
        connectionTimeout: 1000
      });
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const mockReturnValue = {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
      };
      const queryOdbcDataMock = mock.method(
        south,
        'queryOdbcData',
        mock.fn(async () => mockReturnValue)
      );

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(queryOdbcDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryOdbcDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, mockReturnValue);
    });

    it('should get data from ODBC', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string): Array<Record<string, unknown>> => [])
      };
      let queryCallCount = 0;
      odbcConnection.query.mock.mockImplementation((_sql: string) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return [
            { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
            { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
          ];
        }
        return [];
      });

      const odbc = {
        connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection)
      };
      let loadOdbcCallCount = 0;
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => {
        loadOdbcCallCount++;
        if (loadOdbcCallCount <= 2) return odbc;
        return null;
      });

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryOdbcData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(odbc.connect.mock.calls.length, 1);
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: `${configuration.settings.connectionString};PWD=password;`,
        connectionTimeout: configuration.settings.connectionTimeout
      });
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`)
        )
      );
      assert.strictEqual(odbcConnection.query.mock.calls.length, 1);
      assert.deepStrictEqual(odbcConnection.query.mock.calls[0].arguments[0], configuration.items[0].settings.query);
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);

      assert.deepStrictEqual(result, {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
      });

      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[0], [
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
      ]);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[1], configuration.items[0].settings.serialization);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[2], configuration.name);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[3], configuration.items[0]);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[4], testData.constants.dates.FAKE_NOW);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[5], path.resolve('cacheFolder', 'tmp'));

      // Reset for second call
      odbcConnection.close.mock.resetCalls();
      const noResult = await south.queryOdbcData(configuration.items[0], startTime, endTime);
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`No result found for item ${configuration.items[0].name}`)
        )
      );
      assert.deepStrictEqual(noResult, { trackedInstant: null, value: null });
    });

    it('should get data from ODBC without datetime reference', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn(() => [
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
        ])
      };
      const odbc = { connect: mock.fn(() => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn(() => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryOdbcData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);

      assert.deepStrictEqual(result, {
        trackedInstant: null,
        value: {
          anotherTimestamp: '2020-03-01T00:00:00.000Z',
          timestamp: '2020-03-01T00:00:00.000Z',
          value: 2
        }
      });
    });

    it('should manage query error', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string): never => {
          throw new Error('query error');
        })
      };
      const odbc = { connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await assert.rejects(south.queryOdbcData(configuration.items[0], startTime, endTime), { message: 'query error' });
      assert.strictEqual(odbcConnection.query.mock.calls.length, 1);
      assert.deepStrictEqual(odbcConnection.query.mock.calls[0].arguments[0], configuration.items[0].settings.query);
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);
    });

    it('should manage odbc error', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string): never => {
          throw {
            message: 'odbc error',
            odbcErrors: [{ message: 'error1' }, { message: 'error2' }]
          };
        })
      };
      const odbc = { connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await assert.rejects(south.queryOdbcData(configuration.items[0], startTime, endTime), { message: 'odbc error' });

      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error from ODBC driver: error1'
        )
      );
      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error from ODBC driver: error2'
        )
      );
    });

    it('queryOdbcData should throw error if ODBC library not loaded', async () => {
      odbcLoaderExports.loadOdbc = mock.fn(() => null);
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      await assert.rejects(south.queryOdbcData(configuration.items[0], startTime, endTime), { message: 'ODBC library not available' });
    });

    it('should test item with queryOdbcData', async () => {
      const mockReturnValue = {
        trackedInstant: null,
        value: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      };
      const queryOdbcDataMock = mock.method(
        south,
        'queryOdbcData',
        mock.fn(async () => mockReturnValue)
      );

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      assert.strictEqual(queryOdbcDataMock.mock.calls.length, 1);
      assert.strictEqual(utilsExports.convertDateTimeToInstant.mock.calls.length, 0);
      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
    });

    it('QueryOdbcData in case of item test', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string) => [
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
        ])
      };
      const odbc = { connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await south.queryOdbcData(configuration.items[0], startTime, endTime, true);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.strictEqual(odbc.connect.mock.calls.length, 1);
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: `${configuration.settings.connectionString};PWD=password;`,
        connectionTimeout: configuration.settings.connectionTimeout
      });
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`)
        )
      );
      assert.deepStrictEqual(odbcConnection.query.mock.calls[0].arguments[0], configuration.items[0].settings.query);
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);
    });
  });

  describe('SouthODBC odbc driver without authentication', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'odbc',
      description: 'my test connector',
      enabled: true,
      settings: {
        remoteAgent: false,
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        password: null,
        connectionTimeout: 1000,
        retryInterval: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should get data from ODBC without auth', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string) => [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
      };
      const odbc = { connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryOdbcData(configuration.items[0], startTime, endTime);

      assert.strictEqual(odbc.connect.mock.calls.length, 1);
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      });
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Connecting with connection string ${configuration.settings.connectionString}`)
        )
      );

      assert.deepStrictEqual(result, { trackedInstant: '2020-03-01T00:00:00.000Z', value: { timestamp: '2020-03-01T00:00:00.000Z' } });
      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[0], [
        { timestamp: '2020-02-01T00:00:00.000Z' },
        { timestamp: '2020-03-01T00:00:00.000Z' }
      ]);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[1], configuration.items[0].settings.serialization);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[2], configuration.name);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[3], configuration.items[0]);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[4], testData.constants.dates.FAKE_NOW);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[5], path.resolve('cacheFolder', 'tmp'));
    });

    it('should manage connection error', async () => {
      const odbc = {
        connect: mock.fn((_args: unknown): never => {
          throw new Error('connection error');
        })
      };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      await assert.rejects(south.queryOdbcData(configuration.items[0], startTime, endTime), new Error('connection error'));
      assert.strictEqual(odbc.connect.mock.calls.length, 1);
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      });
    });
  });

  describe('SouthODBC odbc driver test connection', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'odbc',
      description: 'my test connector',
      enabled: true,
      settings: {
        remoteAgent: false,
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        password: 'password',
        connectionTimeout: 1000,
        retryInterval: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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

    class NodeOdbcError extends Error {
      public odbcErrors: Array<{ code: number; message: string; state: string }>;
      constructor(message: string, odbcErrors: Array<{ code: number; message: string; state: string }> = []) {
        super();
        this.name = 'ODBCError';
        this.message = message;
        this.odbcErrors = odbcErrors;
      }
    }

    // Error types and the messages thrown by the test function
    const ERROR_TYPE = {
      HOST: 'Please check host and port',
      PORT: 'Please check host and port',
      CREDENTIALS: 'Please check username and password',
      DB_ACCESS: `User does not have access to database`,
      DEFAULT: 'Unable to connect to database'
    } as const;
    const connectionErrorMessage = 'Error creating connection';

    const createOdbcError = (expectedErrorMessage: string, message: string, code: number) => {
      const driverError = new NodeOdbcError(connectionErrorMessage, [{ code, message, state: '' }]);
      const expectedError = new Error(expectedErrorMessage);
      return { driverError, expectedError };
    };

    // Drivers with the errors they are throwing
    const DRIVER_ERRORS: Record<string, Array<{ driverError: NodeOdbcError; expectedError: Error }>> = {
      'SQL Server': [
        createOdbcError(ERROR_TYPE.HOST, 'Host unreachable', 17),
        createOdbcError(ERROR_TYPE.PORT, 'Host:port unreachable', 17),
        createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 18456),
        createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 4060),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
      ],
      PostgreSQL: [
        createOdbcError(ERROR_TYPE.HOST, 'Unknown host', 1),
        createOdbcError(ERROR_TYPE.PORT, 'Connection refused', 1),
        createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1),
        createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 1),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
      ],
      Oracle: [createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1017)],
      MySQL: [
        createOdbcError(ERROR_TYPE.HOST, 'Unknown host', 2005),
        createOdbcError(ERROR_TYPE.PORT, 'Host:port unreachable', 2003),
        createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1045),
        createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 1044),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
      ],
      myOdbcDriver: [
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unknown host', 1),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Host:port unreachable', 2),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Bad username or password', 3),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unreachable Database', 4),
        createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
      ]
    };

    // Flattens the errors inside DRIVER_ERRORS, keeping the name of the driver
    const flattenedErrors = Object.entries(DRIVER_ERRORS).flatMap(([driver, errors]) => errors.map(error => ({ driver, error })));

    beforeEach(() => {
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      const tablesResult = [{ TABLE_NAME: 'logs' }];
      const columnsResult = [
        { COLUMN_NAME: 'data', TYPE_NAME: 'INTEGER' },
        { COLUMN_NAME: 'timestamp', TYPE_NAME: 'datetime' }
      ];
      const odbcConnection = {
        close: mock.fn(),
        tables: mock.fn(() => tablesResult),
        columns: mock.fn(() => columnsResult)
      };
      const odbc = { connect: mock.fn(() => odbcConnection) };
      odbcLoaderExports.loadOdbc = mock.fn(() => odbc);

      await assert.doesNotReject(south.testConnection());
      assert.ok(odbcConnection.close.mock.calls.length > 0);
    });

    for (const driverTest of flattenedErrors) {
      it(`Unable to create connection with ${driverTest.driver}, error code ${driverTest.error.driverError.odbcErrors[0].code}`, async () => {
        const odbc = {
          connect: mock.fn(() => {
            throw driverTest.error.driverError;
          })
        };
        odbcLoaderExports.loadOdbc = mock.fn(() => odbc);

        configuration.settings.connectionString = `Driver=${driverTest.driver}`;

        await assert.rejects(south.testConnection(), new Error(driverTest.error.expectedError.message));
      });
    }

    it('Could not load driver', async () => {
      const error = new NodeOdbcError(connectionErrorMessage, [{ code: -1, message: 'Driver not found', state: 'IM002' }]);
      const odbc = {
        connect: mock.fn(() => {
          throw error;
        })
      };
      odbcLoaderExports.loadOdbc = mock.fn(() => odbc);
      configuration.settings.connectionString = `Driver=Unknown driver`;

      await assert.rejects(south.testConnection(), new Error(`Driver not found. Check connection string and driver`));
    });

    it('Could not load driver (no odbc)', async () => {
      odbcLoaderExports.loadOdbc = mock.fn(() => null);

      await assert.rejects(south.testConnection(), { message: 'ODBC library not available' });
    });

    it('Unable to connect to database without password', async () => {
      const errorMessage = 'Error connecting to database';
      configuration.settings.connectionString = 'myOdbcDriver';
      configuration.settings.password = '';
      const odbc = {
        connect: mock.fn(() => {
          throw new NodeOdbcError(errorMessage, [{ code: -1, message: errorMessage, state: '' }]);
        })
      };
      odbcLoaderExports.loadOdbc = mock.fn(() => odbc);

      await assert.rejects(south.testConnection(), new Error(`Unable to connect to database`));
    });
  });

  describe('SouthODBC odbc remote with authentication', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'odbc',
      description: 'my test connector',
      enabled: true,
      settings: {
        remoteAgent: true,
        agentUrl: 'http://localhost:2224',
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        password: 'password',
        connectionTimeout: 1000,
        retryInterval: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should properly connect to remote agent and disconnect', async () => {
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200, {}));

      await south.connect();
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.ok(
        (httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as URL).href ===
          `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`
      );
      assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      await south.disconnect();
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
      assert.ok(
        (httpRequestExports.HTTPRequest.mock.calls[1].arguments[0] as URL).href ===
          `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/disconnect`
      );
      assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[1].arguments[1], {
        method: 'DELETE'
      });
    });

    it('should properly reconnect to when connection fails', async () => {
      let httpCallCount = 0;
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
        httpCallCount++;
        if (httpCallCount === 1) throw new Error('connection failed');
        return createMockResponse(200, {});
      });

      await south.connect();
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.ok(
        (httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as URL).href ===
          `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`
      );
      assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval!);
      // Wait for the promise created by the setTimeout callback to settle
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
    });

    it('should properly clear reconnect timeout on disconnect', async () => {
      let httpCallCount = 0;
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
        httpCallCount++;
        if (httpCallCount === 1) throw new Error('connection failed');
        if (httpCallCount === 2) return createMockResponse(200, {});
        if (httpCallCount === 3) throw new Error('disconnection failed');
        return createMockResponse(200, {});
      });

      await south.connect();
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

      await south.connect();

      await south.disconnect();
      // After disconnect, advancing timer should not trigger another reconnect
      mock.timers.tick(configuration.settings.retryInterval!);
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 3);

      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(
            `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms.`
          )
        )
      );
      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Error while sending disconnection HTTP request into agent.`)
        )
      );
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const mockReturnValue = {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
      };
      const queryRemoteAgentDataMock = mock.method(
        south,
        'queryRemoteAgentData',
        mock.fn(async () => mockReturnValue)
      );

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(queryRemoteAgentDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryRemoteAgentDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, mockReturnValue);
    });

    it('should get data from Remote agent', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      let httpCallCount = 0;
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
        httpCallCount++;
        if (httpCallCount === 1) {
          return createMockResponse(200, {
            recordCount: 2,
            content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
            maxInstant: '2020-03-01T00:00:00.000Z'
          });
        }
        return createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstant: '2020-03-01T00:00:00.000Z'
        });
      });

      const result = await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.ok(
        (httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as URL).href ===
          `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read`
      );
      assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          sql: configuration.items[0].settings.query,
          readTimeout: configuration.settings.requestTimeout,
          timeColumn: configuration.items[0].settings.dateTimeFields![1].fieldName,
          datasourceTimestampFormat: configuration.items[0].settings.dateTimeFields![1].format,
          datasourceTimezone: configuration.items[0].settings.dateTimeFields![1].timezone,
          delimiter: configuration.items[0].settings.serialization.delimiter,
          outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[0].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      assert.deepStrictEqual(result, {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      });
      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[0], [
        { timestamp: '2020-02-01T00:00:00.000Z' },
        { timestamp: '2020-03-01T00:00:00.000Z' }
      ]);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[1], {
        type: 'file',
        filename: configuration.items[0].settings.serialization.filename,
        compression: configuration.items[0].settings.serialization.compression
      });
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[2], configuration.name);
      assert.deepStrictEqual(utilsExports.persistResults.mock.calls[0].arguments[3], configuration.items[0]);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[4], testData.constants.dates.FAKE_NOW);
      assert.strictEqual(utilsExports.persistResults.mock.calls[0].arguments[5], path.resolve('cacheFolder', 'tmp'));

      await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`No result found for item ${configuration.items[0].name}`)
        )
      );
    });

    it('should get data from Remote agent without datetime reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) =>
        createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: startTime
        })
      );

      const result = await south.queryRemoteAgentData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          sql: configuration.items[1].settings.query,
          readTimeout: configuration.settings.requestTimeout,
          delimiter: configuration.items[1].settings.serialization.delimiter,
          outputTimestampFormat: configuration.items[1].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[1].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      assert.deepStrictEqual(result, {
        trackedInstant: null,
        value: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      });
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      let httpCallCount = 0;
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
        httpCallCount++;
        if (httpCallCount === 1) return createMockResponse(400, 'bad request');
        return createMockResponse(500);
      });

      await assert.rejects(south.queryRemoteAgentData(configuration.items[0], startTime, endTime), {
        message: `Error occurred when querying remote agent with status 400: bad request`
      });
      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Error occurred when querying remote agent with status 400: bad request`
        )
      );

      await assert.rejects(south.queryRemoteAgentData(configuration.items[0], startTime, endTime), {
        message: `Error occurred when querying remote agent with status 500`
      });
      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Error occurred when querying remote agent with status 500`
        )
      );
    });

    it('should test item with queryRemoteAgentData', async () => {
      const mockReturnValue = [
        [
          {
            timestamp: '2020-02-01T00:00:00.000Z',
            table_count: 2
          },
          { timestamp: '2020-03-01T00:00:00.000Z' }
        ]
      ];
      const queryRemoteAgentDataMock = mock.method(
        south,
        'queryRemoteAgentData',
        mock.fn(async () => mockReturnValue)
      );

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      assert.ok(queryRemoteAgentDataMock.mock.calls.length > 0);
    });

    it('QueryRemoteAgentData in case of item test', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) =>
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      );

      await south.queryRemoteAgentData(configuration.items[0], startTime, endTime, true);
      assert.ok(httpRequestExports.HTTPRequest.mock.calls.length > 0);
    });
  });

  describe('SouthODBC odbc remote test connection', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'odbc',
      description: 'my test connector',
      enabled: true,
      settings: {
        remoteAgent: true,
        agentUrl: 'http://localhost:2224',
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        password: 'password',
        connectionTimeout: 1000,
        retryInterval: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthODBCItemSettingsDateTimeFields,
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
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should test connection successfully', async () => {
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200, 'bad request'));
      await assert.doesNotReject(south.testConnection());
    });

    it('should test connection fail', async () => {
      let httpCallCount = 0;
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
        httpCallCount++;
        if (httpCallCount === 1) return createMockResponse(400, 'bad request');
        return createMockResponse(500, 'another error');
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Error occurred when sending connect command to remote agent with status 400: bad request`)
      );

      await assert.rejects(
        south.testConnection(),
        new Error(`Error occurred when sending connect command to remote agent with status 500`)
      );
    });
  });
});
