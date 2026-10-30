import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { ReqResponse } from '../../service/http-request.utils';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthODBCClass from './south-odbc';

const nodeRequire = createRequire(import.meta.url);

const trackingInstant: SouthODBCItemSettings['trackingInstant'] = {
  trackInstant: true,
  fieldName: 'timestamp',
  dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
};

const buildItem = (
  id: string,
  query: string,
  itemTrackingInstant: SouthODBCItemSettings['trackingInstant'],
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthODBCItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
  enabled: true,
  settings: { query, trackingInstant: itemTrackingInstant },
  scanMode,
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

const buildConfiguration = (settings: Partial<SouthODBCSettings>): SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> => ({
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
    requestTimeout: 1000,
    ...settings
  },
  groups: [],
  items: [
    buildItem('id1', 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime', trackingInstant),
    buildItem('id2', 'query2', null),
    buildItem('id3', 'query3', trackingInstant, testData.scanMode.list[1])
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

describe('SouthODBC', () => {
  let SouthODBC: typeof SouthODBCClass;
  let south: SouthODBCClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let HTTPRequest: Mock<(url: URL | string, options?: unknown) => Promise<ReqResponse>>;
  // The odbc driver loaded by loadOdbc(), and the connection its connect() opens
  let odbcConnection: { query: Mock<(sql: string) => unknown>; close: Mock<() => void> };
  let odbc: { connect: Mock<(args: unknown) => unknown> };
  let loadOdbc: Mock<() => unknown>;

  const odbcLoaderExports: Record<string, unknown> = {};
  const httpRequestExports: Record<string, unknown> = { __esModule: true };

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((instant: unknown, _options: unknown) => instant),
    formatInstant: mock.fn((instant: unknown, _options: unknown) => `formatted ${instant}`),
    logQuery: mock.fn()
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, './odbc-loader', odbcLoaderExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthODBC = reloadModule<{ default: typeof SouthODBCClass }>(nodeRequire, './south-odbc').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    HTTPRequest = mock.fn(async () => createMockResponse(200, {}));
    httpRequestExports.HTTPRequest = HTTPRequest;
    odbcConnection = { query: mock.fn(() => []), close: mock.fn() };
    odbc = { connect: mock.fn(() => odbcConnection) };
    loadOdbc = mock.fn(() => odbc);
    odbcLoaderExports.loadOdbc = loadOdbc;
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>) =>
    new SouthODBC(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  describe('SouthODBC odbc driver with authentication', () => {
    const configuration = buildConfiguration({});

    beforeEach(() => {
      south = createSouth(configuration);
    });

    it('should do nothing on connect and disconnect', async () => {
      await south.connect();
      await south.disconnect();
      assert.strictEqual(HTTPRequest.mock.calls.length, 0);
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

    it('should send the records of historyQuery and track the max instant', async () => {
      const records = [
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z' },
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z' },
        { value: 3, timestamp: null }
      ];
      const queryDataMock = mock.method(south, 'queryData', async () => records);

      const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(0, 4), [
        'southId',
        { type: 'record-list', content: records },
        testData.constants.dates.FAKE_NOW,
        [configuration.items[0]]
      ]);
      assert.deepStrictEqual(utilsExports.convertDateTimeToInstant.mock.calls[0].arguments, [
        '2020-02-01T00:00:00.000Z',
        trackingInstant!.dateTimeInput
      ]);
      assert.deepStrictEqual(result, { trackedInstant: '2020-03-01T00:00:00.000Z', value: records[2] });
    });

    it('should not track an instant without tracking field', async () => {
      mock.method(south, 'queryData', async () => [{ value: 1 }]);

      const result = await south.historyQuery([configuration.items[1]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

      assert.deepStrictEqual(result, { trackedInstant: null, value: { value: 1 } });
      assert.strictEqual(utilsExports.convertDateTimeToInstant.mock.calls.length, 0);
    });

    it('should not send anything when there is no result', async () => {
      mock.method(south, 'queryData', async () => []);

      const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
        )
      );
    });

    it('should get data from ODBC', async () => {
      const rows = Object.assign([{ value: 1, timestamp: '2020-02-01 00:00:00.000' }], { count: 1, columns: [] });
      odbcConnection.query.mock.mockImplementationOnce(() => rows);
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      const adaptedQuery = `SELECT * FROM logs WHERE timestamp > formatted ${startTime} AND timestamp <= formatted ${endTime}`;
      assert.deepStrictEqual(utilsExports.formatInstant.mock.calls[0].arguments, [startTime, trackingInstant!.dateTimeInput]);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments.slice(0, 3), [
        adaptedQuery,
        `formatted ${startTime}`,
        `formatted ${endTime}`
      ]);
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: `${configuration.settings.connectionString};PWD=password;`,
        connectionTimeout: configuration.settings.connectionTimeout
      });
      assert.ok(
        logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`)
        )
      );
      assert.deepStrictEqual(odbcConnection.query.mock.calls[0].arguments[0], adaptedQuery);
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);
      // Only the rows are kept, not the statement metadata the driver adds to the array
      assert.deepStrictEqual(result, [{ value: 1, timestamp: '2020-02-01 00:00:00.000' }]);
      assert.strictEqual(HTTPRequest.mock.calls.length, 0);
    });

    it('should not format the query times without tracking field', async () => {
      await south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
      assert.deepStrictEqual(odbcConnection.query.mock.calls[0].arguments[0], 'query2');
    });

    it('should manage query error', async () => {
      odbcConnection.query.mock.mockImplementation(() => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
        message: 'query error'
      });
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);
    });

    it('should manage odbc error', async () => {
      odbcConnection.query.mock.mockImplementation(() => {
        throw {
          message: 'odbc error',
          odbcErrors: [{ message: 'error1' }, { message: 'error2' }]
        };
      });

      await assert.rejects(south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
        message: 'odbc error'
      });

      assert.ok(logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'Error from ODBC driver: error1'));
      assert.ok(logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'Error from ODBC driver: error2'));
    });

    it('should throw an error if the ODBC library is not loaded', async () => {
      loadOdbc.mock.mockImplementation(() => null);

      await assert.rejects(south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
        message: 'ODBC library not available'
      });
    });

    it('should test an item', async () => {
      const records = [{ value: 1, timestamp: '2020-02-01 00:00:00.000' }];
      const queryDataMock = mock.method(south, 'queryData', async () => {
        mock.timers.tick(25);
        return records;
      });

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.south.itemTestingSettings.history!.startTime,
        testData.south.itemTestingSettings.history!.endTime
      ]);
      assert.deepStrictEqual(result, { result: { type: 'record-list', content: records }, connectionDuration: 0, queryDuration: 25 });
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
    });
  });

  describe('SouthODBC odbc driver without authentication', () => {
    const configuration = buildConfiguration({ password: null });

    beforeEach(() => {
      south = createSouth(configuration);
    });

    it('should get data from ODBC without auth', async () => {
      await south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments[0], {
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      });
      assert.ok(
        logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Connecting with connection string ${configuration.settings.connectionString}`)
        )
      );
    });

    it('should manage connection error', async () => {
      odbc.connect.mock.mockImplementation(() => {
        throw new Error('connection error');
      });

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
      south = createSouth(buildConfiguration({}));
    });

    it('Database is reachable and has tables', async () => {
      const result = await south.testConnection();

      assert.deepStrictEqual(result, { items: [] });
      assert.strictEqual(loadOdbc.mock.calls.length, 1);
      assert.strictEqual(odbc.connect.mock.calls.length, 1);
      // The password is appended to the connection string
      assert.deepStrictEqual(odbc.connect.mock.calls[0].arguments, [
        { connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;PWD=password;', connectionTimeout: 1000 }
      ]);
      assert.strictEqual(odbcConnection.close.mock.calls.length, 1);
    });

    for (const driverTest of flattenedErrors) {
      it(`Unable to create connection with ${driverTest.driver}, error code ${driverTest.error.driverError.odbcErrors[0].code}`, async () => {
        odbc.connect.mock.mockImplementation(() => {
          throw driverTest.error.driverError;
        });
        south = createSouth(buildConfiguration({ connectionString: `Driver=${driverTest.driver}` }));

        await assert.rejects(south.testConnection(), new Error(driverTest.error.expectedError.message));
      });
    }

    it('Could not load driver', async () => {
      odbc.connect.mock.mockImplementation(() => {
        throw new NodeOdbcError(connectionErrorMessage, [{ code: -1, message: 'Driver not found', state: 'IM002' }]);
      });
      south = createSouth(buildConfiguration({ connectionString: `Driver=Unknown driver` }));

      await assert.rejects(south.testConnection(), new Error(`Driver not found. Check connection string and driver`));
    });

    it('Could not load driver (no odbc)', async () => {
      loadOdbc.mock.mockImplementation(() => null);

      await assert.rejects(south.testConnection(), { message: 'ODBC library not available' });
    });

    it('Unable to connect to database without password', async () => {
      const errorMessage = 'Error connecting to database';
      odbc.connect.mock.mockImplementation(() => {
        throw new NodeOdbcError(errorMessage, [{ code: -1, message: errorMessage, state: '' }]);
      });
      south = createSouth(buildConfiguration({ connectionString: 'myOdbcDriver', password: '' }));

      await assert.rejects(south.testConnection(), new Error(`Unable to connect to database`));
    });
  });

  describe('SouthODBC odbc remote with authentication', () => {
    const configuration = buildConfiguration({ remoteAgent: true, agentUrl: 'http://localhost:2224' });

    beforeEach(() => {
      south = createSouth(configuration);
    });

    it('should properly connect to remote agent and disconnect', async () => {
      await south.connect();
      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.ok(
        (HTTPRequest.mock.calls[0].arguments[0] as URL).href === `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`
      );
      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
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
      assert.strictEqual(HTTPRequest.mock.calls.length, 2);
      assert.ok(
        (HTTPRequest.mock.calls[1].arguments[0] as URL).href ===
          `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/disconnect`
      );
      assert.deepStrictEqual(HTTPRequest.mock.calls[1].arguments[1], {
        method: 'DELETE'
      });
    });

    it('should properly reconnect to when connection fails', async () => {
      HTTPRequest.mock.mockImplementationOnce(async () => {
        throw new Error('connection failed');
      });

      await south.connect();
      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.ok(
        (HTTPRequest.mock.calls[0].arguments[0] as URL).href === `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`
      );
      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mock.timers.tick(configuration.settings.retryInterval!);
      // Wait for the promise created by the setTimeout callback to settle
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(HTTPRequest.mock.calls.length, 2);
    });

    it('should properly clear reconnect timeout on disconnect', async () => {
      HTTPRequest.mock.mockImplementationOnce(async () => {
        throw new Error('connection failed');
      }, 0);
      HTTPRequest.mock.mockImplementationOnce(async () => {
        throw new Error('disconnection failed');
      }, 2);

      await south.connect();
      assert.strictEqual(HTTPRequest.mock.calls.length, 1);

      await south.connect();

      await south.disconnect();
      // After disconnect, advancing timer should not trigger another reconnect
      mock.timers.tick(configuration.settings.retryInterval!);
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(HTTPRequest.mock.calls.length, 3);

      assert.ok(
        logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(
            `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms.`
          )
        )
      );
      assert.ok(
        logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Error while sending disconnection HTTP request into agent:`)
        )
      );
    });

    it('should get data from the remote agent', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';
      const content = ['value\u001Ftimestamp', '1\u001F2020-02-01T00:00:00.000Z', '2\u001F', ''].join('\r\n');
      HTTPRequest.mock.mockImplementation(async () =>
        createMockResponse(200, { recordCount: 2, content, maxInstant: '2020-02-01T00:00:00Z' })
      );

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      const adaptedQuery = `SELECT * FROM logs WHERE timestamp > formatted ${startTime} AND timestamp <= formatted ${endTime}`;
      assert.strictEqual(
        (HTTPRequest.mock.calls[0].arguments[0] as URL).href,
        `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read`
      );
      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          sql: adaptedQuery,
          readTimeout: configuration.settings.requestTimeout,
          timeColumn: 'timestamp',
          datasourceTimestampFormat: trackingInstant!.dateTimeInput!.format,
          datasourceTimezone: trackingInstant!.dateTimeInput!.timezone,
          delimiter: '\u001F',
          outputTimestampFormat: "uuuu'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'",
          outputTimezone: 'UTC'
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      assert.deepStrictEqual(result, [
        { value: '1', timestamp: '2020-02-01T00:00:00.000Z' },
        { value: '2', timestamp: null }
      ]);
      assert.strictEqual(odbc.connect.mock.calls.length, 0);
    });

    it('should not send the time column to the remote agent without tracking field', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, { recordCount: 0, content: 'value', maxInstant: '' }));

      const result = await south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(JSON.parse((HTTPRequest.mock.calls[0].arguments[1] as { body: string }).body), {
        connectionString: configuration.settings.connectionString,
        sql: 'query2',
        readTimeout: configuration.settings.requestTimeout,
        delimiter: '\u001F',
        outputTimestampFormat: "uuuu'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'",
        outputTimezone: 'UTC'
      });
      assert.deepStrictEqual(result, []);
    });

    it('should track the max instant from the ISO strings sent by the remote agent', async () => {
      mock.method(south, 'queryData', async () => [{ timestamp: '2020-02-01T00:00:00.000Z' }]);

      const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

      assert.deepStrictEqual(utilsExports.convertDateTimeToInstant.mock.calls[0].arguments, [
        '2020-02-01T00:00:00.000Z',
        { type: 'iso-string' }
      ]);
      assert.strictEqual(result.trackedInstant, '2020-02-01T00:00:00.000Z');
    });

    it('should manage query error', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(500));
      HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));

      await assert.rejects(south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
        message: `Error occurred when querying remote agent with status 400: bad request`
      });

      await assert.rejects(south.queryData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
        message: `Error occurred when querying remote agent with status 500`
      });
    });
  });

  describe('SouthODBC odbc remote test connection', () => {
    beforeEach(() => {
      south = createSouth(buildConfiguration({ remoteAgent: true, agentUrl: 'http://localhost:2224' }));
    });

    it('should test connection successfully', async () => {
      await assert.doesNotReject(south.testConnection());
    });

    it('should test connection fail', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(500, 'another error'));
      HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));

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
