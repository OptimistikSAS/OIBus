import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/south-settings.model';
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

  const utilsExports = {
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items]),
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    logQuery: mock.fn(),
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

  const odbcLoaderExports = {
    loadOdbc: mock.fn((): OdbcMockInstance => null)
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, './odbc-loader', odbcLoaderExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthODBC = reloadModule<{ default: typeof SouthODBCClass }>(nodeRequire, './south-odbc').default;
  });

  beforeEach(() => {
    addContentCallback.mock.resetCalls();

    // Reset utils mocks
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.logQuery = mock.fn();

    // Reset other mocks
    odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => null);

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
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
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
          trackingInstant: {
            trackInstant: true,
            fieldName: 'timestamp',
            dateTimeInput: {
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          }
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
          query: 'query2',
          trackingInstant: { trackInstant: false }
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
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
          trackingInstant: {
            trackInstant: true,
            fieldName: 'timestamp',
            dateTimeInput: {
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          }
        },
        scanMode: testData.scanMode.list[1],
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

  describe('SouthODBC odbc driver with authentication', () => {
    let south: SouthODBCClass;

    const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = JSON.parse(JSON.stringify(configurationWithAuth));

    beforeEach(() => {
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
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
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
        ])
      );

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'record-list',
        content: [
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
        ]
      });
      assert.deepStrictEqual(result, {
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
      });
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
        )
      );
    });

    it('should get data from ODBC', async () => {
      const odbcConnection = {
        close: mock.fn(),
        query: mock.fn((_sql: string): Array<Record<string, unknown>> => [
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
        ])
      };
      const odbc = {
        connect: mock.fn((_args: unknown): typeof odbcConnection => odbcConnection)
      };
      odbcLoaderExports.loadOdbc = mock.fn((): OdbcMockInstance => odbc);

      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryData(configuration.items[0], startTime, endTime);

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

      assert.deepStrictEqual(result, [
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
      ]);
    });

    it('should get data from ODBC without a tracked datetime', async () => {
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

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);
      // No trackingInstant configured -> the raw Instant is substituted as-is, formatInstant is not called.
      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);

      assert.deepStrictEqual(result, [
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
      ]);
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

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), { message: 'query error' });
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

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), { message: 'odbc error' });

      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[1] === 'Error from ODBC driver: error1'
        )
      );
      assert.ok(
        (logger.error as ReturnType<typeof mock.fn>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[1] === 'Error from ODBC driver: error2'
        )
      );
    });

    it('queryData should throw error if ODBC library not loaded', async () => {
      odbcLoaderExports.loadOdbc = mock.fn(() => null);
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), { message: 'ODBC library not available' });
    });

    it('should test item', async () => {
      const mockReturnValue = [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }];
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => {
          mock.timers.tick(25);
          return mockReturnValue;
        })
      );

      const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(result.result, { type: 'record-list', content: mockReturnValue });
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
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
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
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
            trackingInstant: {
              trackInstant: true,
              fieldName: 'timestamp',
              dateTimeInput: {
                type: 'string',
                timezone: 'Europe/Paris',
                format: 'yyyy-MM-dd HH:mm:ss.SSS',
                locale: 'en-US'
              }
            }
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
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
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

      const result = await south.queryData(configuration.items[0], startTime, endTime);

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

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
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

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));
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
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
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
      south = new SouthODBC(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('Database is reachable', async () => {
      const odbcConnection = { close: mock.fn() };
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
});
