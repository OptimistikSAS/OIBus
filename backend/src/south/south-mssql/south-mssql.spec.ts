import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthMSSQLItemSettings, SouthMSSQLSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthMSSQLClass from './south-mssql';

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

const trackedItemSettings = (query: string): SouthMSSQLItemSettings => ({
  query,
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
});

const buildItem = (
  id: string,
  settings: SouthMSSQLItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthMSSQLItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  enabled: true,
  settings,
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

const buildConfiguration = (
  settings: Partial<SouthMSSQLSettings>,
  items: Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>
): SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings> => ({
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
    trustServerCertificate: true,
    ...settings
  },
  groups: [],
  items,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

const items = [
  buildItem('id1', trackedItemSettings('SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime')),
  buildItem('id2', { query: 'query2', trackingInstant: { trackInstant: false } }),
  buildItem('id3', trackedItemSettings('query3'), testData.scanMode.list[1])
];

describe('SouthMSSQL', () => {
  let SouthMSSQL: typeof SouthMSSQLClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let query: Mock<(sql?: unknown) => unknown>;
  let input: Mock<(...args: Array<unknown>) => void>;
  let close: Mock<() => void>;
  let connect: Mock<() => unknown>;
  let connectionPool: Mock<(config: unknown) => unknown>;

  const mssqlExports: Record<string, unknown> = { __esModule: true };
  mssqlExports.default = mssqlExports;

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    logQuery: mock.fn(),
    extractDiscoveryQuery: mock.fn(realUtils.extractDiscoveryQuery)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'mssql', mssqlExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthMSSQL = reloadModule<{ default: typeof SouthMSSQLClass }>(nodeRequire, './south-mssql').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    query = mock.fn(() => ({
      recordsets: [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]
    }));
    input = mock.fn();
    close = mock.fn();
    connect = mock.fn(() => ({ request: () => ({ input, query }), close }));
    connectionPool = mock.fn(function () {
      return { connect };
    });
    mssqlExports.ConnectionPool = connectionPool;
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthMSSQL with authentication', () => {
    let south: SouthMSSQLClass;
    const configuration = buildConfiguration({}, items);

    beforeEach(() => {
      south = new SouthMSSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
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
      utilsExports.formatInstant.mock.mockImplementation(() => '2020-02-01 00:00:00.000');

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'record-list',
        content: [
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
        ]
      });
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
      const foundLog = logger.info.mock.calls.find(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Found 2 results')
      );
      assert.ok(foundLog);
      assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
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

    it('should get data from MSSQL', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const endTime = '2022-01-01T00:00:00.000Z';

      let formatCallCount = 0;
      utilsExports.formatInstant.mock.mockImplementation(() => {
        formatCallCount++;
        if (formatCallCount === 1) return '2020-01-01 00:00:00.000';
        if (formatCallCount === 2) return '2022-01-01 00:00:00.000';
        return startTime;
      });

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 2);
      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(connectionPool.mock.calls.length, 1);
      assert.deepStrictEqual(connectionPool.mock.calls[0].arguments[0], {
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
        mock.fn(async () => {
          mock.timers.tick(25);
          return [
            { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
            { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
          ];
        })
      );
      utilsExports.formatInstant.mock.mockImplementation(() => formattedInstant);

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
    });

    it("should discover a Configuration Workflow's dedicated metadata query, with no @StartTime/@EndTime substitution", async () => {
      query.mock.mockImplementationOnce(() => ({
        recordsets: [[{ column_name: 'temp', description: 'Temperature' }]]
      }));

      const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

      assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
        query: 'SELECT column_name, description FROM my_metadata_table'
      });
      assert.ok(query.mock.calls.some(c => c.arguments[0] === 'SELECT column_name, description FROM my_metadata_table'));
      // No time-range params - a metadata query is independent of any item's own data query.
      assert.strictEqual(input.mock.calls.length, 0);
      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
    });

    it('should discover the item of each table checked in the explore modal, quoted and tracked as MSSQL reads them', async () => {
      mock.method(south, 'explore', async (parentId: string | null) =>
        parentId === null
          ? [{ id: 'dbo.production', name: 'dbo.production', metadata: { columns: 3 }, hasChildren: true }]
          : [
              { id: `${parentId}.id`, name: 'id', metadata: { type: 'int' }, hasChildren: false },
              { id: `${parentId}.value`, name: 'value', metadata: { type: 'float' }, hasChildren: false },
              { id: `${parentId}.produced_at`, name: 'produced_at', metadata: { type: 'datetime2' }, hasChildren: false }
            ]
      );

      const records = await south.discover({ nodeIds: ['dbo.production.value'] });

      assert.deepStrictEqual(records, [
        {
          id: 'dbo.production',
          name: 'dbo.production',
          query: 'SELECT [produced_at], [value] FROM [dbo].[production] WHERE [produced_at] > @StartTime AND [produced_at] <= @EndTime',
          plainQuery: 'SELECT [produced_at], [value] FROM [dbo].[production]',
          trackInstant: true,
          timeColumn: 'produced_at',
          dateTimeType: 'date-time-2'
        }
      ]);
    });

    it('should close the connection and rethrow when the discovery query fails', async () => {
      const queryError = new Error('bad query');
      query.mock.mockImplementationOnce(() => {
        throw queryError;
      });

      await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it('should list every table, schema-qualified, with its column and row counts when exploring the root', async () => {
      query.mock.mockImplementationOnce(() => ({
        recordsets: [
          [
            { tableSchema: 'dbo', tableName: 'Reactor', columnCount: 3, rowCount: 120 },
            { tableSchema: 'dbo', tableName: 'Empty', columnCount: 2, rowCount: 0 }
          ]
        ]
      }));

      const result = await south.explore(null);

      assert.ok(String(query.mock.calls[0].arguments[0]).includes('sys.tables'));
      // No bind params at the root level - only expanding a table needs @tableSchema/@tableName.
      assert.strictEqual(input.mock.calls.length, 0);
      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [
        {
          id: 'dbo.Reactor',
          name: 'dbo.Reactor',
          metadata: { columns: 3, rows: 120, select: 'SELECT * FROM [dbo].[Reactor]' },
          hasChildren: true
        },
        { id: 'dbo.Empty', name: 'dbo.Empty', metadata: { columns: 2, rows: 0, select: 'SELECT * FROM [dbo].[Empty]' }, hasChildren: true }
      ]);
    });

    it('should close the connection and rethrow when exploring the root fails', async () => {
      const queryError = new Error('bad query');
      query.mock.mockImplementationOnce(() => {
        throw queryError;
      });

      await assert.rejects(south.explore(null), queryError);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it("should list a table's columns, with type/nullability/primary-key/default, when expanding it", async () => {
      query.mock.mockImplementationOnce(() => ({
        recordsets: [
          [
            { name: 'id', type: 'int', nullable: 'NO', columnDefault: null, isPrimaryKey: 1 },
            { name: 'value', type: 'float', nullable: 'YES', columnDefault: '0', isPrimaryKey: 0 }
          ]
        ]
      }));

      const result = await south.explore('dbo.Reactor');

      assert.ok(input.mock.calls.some(c => c.arguments[0] === 'tableSchema' && c.arguments[1] === 'dbo'));
      assert.ok(input.mock.calls.some(c => c.arguments[0] === 'tableName' && c.arguments[1] === 'Reactor'));
      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [
        { id: 'dbo.Reactor.id', name: 'id', metadata: { type: 'int', nullable: 'no', primaryKey: 'yes' }, hasChildren: false },
        { id: 'dbo.Reactor.value', name: 'value', metadata: { type: 'float', nullable: 'yes', default: '0' }, hasChildren: false }
      ]);
    });

    it("should close the connection and rethrow when exploring a table's columns fails", async () => {
      const queryError = new Error('bad query');
      query.mock.mockImplementationOnce(() => {
        throw queryError;
      });

      await assert.rejects(south.explore('dbo.Reactor'), queryError);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it('should test item without datetimeFields', async () => {
      const formattedInstant = testData.constants.dates.DATE_1;
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
      utilsExports.formatInstant.mock.mockImplementation(() => formattedInstant);

      const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
    });
  });

  describe('SouthMSSQL without authentication', () => {
    let south: SouthMSSQLClass;
    const configuration = buildConfiguration({ username: null, password: null, domain: null }, items);

    beforeEach(() => {
      south = new SouthMSSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('should manage query error', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const endTime = '2022-01-01T00:00:00.000Z';

      query.mock.mockImplementationOnce(() => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[1], startTime, endTime), new Error('query error'));
      assert.deepStrictEqual(connectionPool.mock.calls[0].arguments[0], {
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
    const configuration = buildConfiguration({}, []);

    beforeEach(() => {
      south = new SouthMSSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let queryCallCount = 0;
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
        connectionPool.mock.mockImplementation(function () {
          throw new MSSQLError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'INFORMATION_SCHEMA.TABLES does not exist';
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
      query.mock.mockImplementation(() => ({ recordsets: [[{ table_count: 0 }]] }));
      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      query.mock.mockImplementation(() => ({ recordsets: [[]] }));
      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Unable to connect to database without password', async () => {
      const errorMessage = 'Error connecting to database';
      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        connect.mock.mockImplementationOnce(() => {
          throw new MSSQLError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });
  });
});
