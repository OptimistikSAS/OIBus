import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthMySQLItemSettings, SouthMySQLSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthMySQLClass from './south-mysql';

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

const trackedItemSettings = (query: string): SouthMySQLItemSettings => ({
  query,
  requestTimeout: 1000,
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
  settings: SouthMySQLItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthMySQLItemSettings> => ({
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
  settings: Partial<SouthMySQLSettings>,
  items: Array<SouthConnectorItemEntity<SouthMySQLItemSettings>>
): SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings> => ({
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
    connectionTimeout: 1000,
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
  buildItem('id1', trackedItemSettings('query1')),
  buildItem('id2', { query: 'query2', requestTimeout: 1000, trackingInstant: { trackInstant: false } }),
  buildItem('id3', trackedItemSettings('query3'), testData.scanMode.list[1])
];

describe('SouthMySQL', () => {
  let SouthMySQL: typeof SouthMySQLClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let execute: Mock<(query: unknown, params?: unknown) => Promise<unknown>>;
  let ping: Mock<() => void>;
  let end: Mock<() => void>;
  let createConnection: Mock<(config: unknown) => Promise<unknown>>;

  const mysqlExports: Record<string, unknown> = { __esModule: true };
  mysqlExports.default = mysqlExports;

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateReplacementParameters: mock.fn((): unknown => []),
    logQuery: mock.fn(),
    extractDiscoveryQuery: mock.fn(realUtils.extractDiscoveryQuery)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'mysql2/promise', mysqlExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthMySQL = reloadModule<{ default: typeof SouthMySQLClass }>(nodeRequire, './south-mysql').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    execute = mock.fn(async () => [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]);
    ping = mock.fn();
    end = mock.fn();
    createConnection = mock.fn(async () => ({ execute, ping, end }));
    mysqlExports.createConnection = createConnection;
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthMySQL with authentication', () => {
    let south: SouthMySQLClass;
    const configuration = buildConfiguration({}, items);

    beforeEach(() => {
      south = new SouthMySQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
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

    it('should get data from MySQL', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      let formatCallCount = 0;
      utilsExports.formatInstant.mock.mockImplementation(() => {
        formatCallCount++;
        if (formatCallCount === 1) return startTime;
        if (formatCallCount === 2) return endTime;
        return startTime;
      });
      utilsExports.generateReplacementParameters.mock.mockImplementation(() => ({ startTime, endTime }));

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(createConnection.mock.calls.length, 1);
      assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        user: configuration.settings.username,
        password: configuration.settings.password,
        database: configuration.settings.database,
        connectTimeout: configuration.settings.connectionTimeout,
        timezone: 'Z'
      });

      assert.strictEqual(execute.mock.calls.length, 1);
      assert.deepStrictEqual(execute.mock.calls[0].arguments[0], {
        sql: configuration.items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        values: { startTime, endTime },
        timeout: configuration.items[0].settings.requestTimeout
      });
      assert.strictEqual(end.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should get data from MySQL without reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters.mock.mockImplementation(() => ({ startTime, endTime }));
      execute.mock.mockImplementation(async () => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('query error'));

      assert.strictEqual(execute.mock.calls.length, 1);
      assert.deepStrictEqual(execute.mock.calls[0].arguments[0], {
        sql: configuration.items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        values: { startTime, endTime },
        timeout: configuration.items[0].settings.requestTimeout
      });
      assert.strictEqual(end.mock.calls.length, 1);
    });

    it('should test item', async () => {
      // testItem() delegates the whole connect+query cycle to queryData() — it no longer opens
      // its own separate connection first (that was dead code: a connection opened and closed
      // without ever being used, since queryData() always opens its own).
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
      assert.strictEqual(result.connectionDuration, 0);
      assert.strictEqual(result.queryDuration, 25);
    });

    it('should test item without datetimeFields', async () => {
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

      const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
      assert.strictEqual(result.connectionDuration, 0);
      assert.strictEqual(result.queryDuration, 25);
    });

    it("should discover a Configuration Workflow's dedicated metadata query, with no @StartTime/@EndTime substitution", async () => {
      execute.mock.mockImplementation(async () => [[{ column_name: 'temp', description: 'Temperature' }]]);

      const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

      assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
        query: 'SELECT column_name, description FROM my_metadata_table'
      });
      assert.strictEqual(execute.mock.calls.length, 1);
      assert.strictEqual(execute.mock.calls[0].arguments[0], 'SELECT column_name, description FROM my_metadata_table');
      assert.strictEqual(end.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
    });

    it('should explore the tables of the database, then the columns of a table', async () => {
      execute.mock.mockImplementation(async query =>
        String(query).includes('information_schema.TABLES')
          ? [[{ tableName: 'production', rowCount: '1200', columnCount: 2 }]]
          : [
              [
                { name: 'id', type: 'int', nullable: 'NO', columnDefault: null, columnKey: 'PRI' },
                { name: 'produced_at', type: 'datetime', nullable: 'YES', columnDefault: 'CURRENT_TIMESTAMP', columnKey: '' }
              ]
            ]
      );

      assert.deepStrictEqual(await south.explore(null), [
        { id: 'production', name: 'production', metadata: { columns: 2, rows: 1200 }, hasChildren: true }
      ]);
      assert.deepStrictEqual(await south.explore('production'), [
        { id: 'production.id', name: 'id', metadata: { nullable: 'no', type: 'int', primaryKey: 'yes' }, hasChildren: false },
        {
          id: 'production.produced_at',
          name: 'produced_at',
          metadata: { nullable: 'yes', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          hasChildren: false
        }
      ]);
      assert.deepStrictEqual(execute.mock.calls[1].arguments[1], ['production']);
      assert.strictEqual(end.mock.calls.length, 2);
    });

    it('should close the connection when exploring fails', async () => {
      execute.mock.mockImplementation(async () => {
        throw new Error('denied');
      });

      await assert.rejects(south.explore(null), new Error('denied'));
      assert.strictEqual(end.mock.calls.length, 1);
    });

    it('should discover the item of each table checked in the explore modal, quoted and tracked as MySQL reads them', async () => {
      mock.method(south, 'explore', async (parentId: string | null) =>
        parentId === null
          ? [{ id: 'production', name: 'production', metadata: { columns: 3 }, hasChildren: true }]
          : [
              { id: `${parentId}.id`, name: 'id', metadata: { type: 'int' }, hasChildren: false },
              { id: `${parentId}.value`, name: 'value', metadata: { type: 'float' }, hasChildren: false },
              { id: `${parentId}.produced_at`, name: 'produced_at', metadata: { type: 'datetime' }, hasChildren: false }
            ]
      );

      const records = await south.discover({ nodeIds: ['production.value'] });

      assert.deepStrictEqual(records, [
        {
          id: 'production',
          name: 'production',
          query: 'SELECT `produced_at`, `value` FROM `production` WHERE `produced_at` > @StartTime AND `produced_at` <= @EndTime',
          trackInstant: true,
          timeColumn: 'produced_at',
          dateTimeType: 'date-time'
        }
      ]);
    });

    it('should close the connection and rethrow when the discovery query fails', async () => {
      const queryError = new Error('bad query');
      execute.mock.mockImplementation(async () => {
        throw queryError;
      });

      await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
      assert.strictEqual(end.mock.calls.length, 1);
    });
  });

  describe('SouthMySQL without authentication', () => {
    let south: SouthMySQLClass;
    const configuration = buildConfiguration({ username: null, password: null }, items);

    beforeEach(() => {
      south = new SouthMySQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      createConnection.mock.mockImplementation(() => {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));

      assert.strictEqual(createConnection.mock.calls.length, 1);
      assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        user: undefined,
        password: undefined,
        database: configuration.settings.database,
        connectTimeout: configuration.settings.connectionTimeout,
        timezone: 'Z'
      });
    });
  });

  describe('SouthMySQL test connection', () => {
    let south: SouthMySQLClass;
    const configuration = buildConfiguration({}, []);

    beforeEach(() => {
      south = new SouthMySQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let executeCallCount = 0;
      execute.mock.mockImplementation(async () => {
        executeCallCount++;
        if (executeCallCount === 1) return [[{ table_count: 21 }]];
        return [[{ version: '8.0.32' }]];
      });

      const testResult = await south.testConnection();

      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Version', value: '8.0.32' },
          { key: 'Tables', value: '21' }
        ]
      });
      assert.ok(end.mock.calls.length > 0);
    });

    it('Database is reachable but version is unavailable', async () => {
      let executeCallCount = 0;
      execute.mock.mockImplementation(async () => {
        executeCallCount++;
        if (executeCallCount === 1) return [[{ table_count: 5 }]];
        return [[{}]]; // no version key
      });

      const testResult = await south.testConnection();

      assert.deepStrictEqual(testResult, { items: [{ key: 'Tables', value: '5' }] });
      assert.ok(end.mock.calls.length > 0);
    });

    it('Unable to create connection', async () => {
      const errorMessage = 'Error creating connection';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        createConnection.mock.mockImplementation(() => {
          throw new MYSQL2Error(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('Unable to ping database', async () => {
      const errorMessage = 'Error pinging database';

      for (const [index, code] of (Object.keys(ERROR_CODES) as Array<ErrorCodes>).entries()) {
        ping.mock.mockImplementation(() => {
          throw new MYSQL2Error(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
        assert.strictEqual(end.mock.calls.length, index + 1);
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'information_schema.TABLES does not exist';
      execute.mock.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
      );
      assert.ok(end.mock.calls.length > 0);
    });

    it('Database has no tables', async () => {
      execute.mock.mockImplementation(async () => [[{ table_count: 0 }]]);

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(end.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      execute.mock.mockImplementation(async () => [[]]);

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(end.mock.calls.length > 0);
    });

    it('Unable to ping database without password', async () => {
      south = new SouthMySQL(
        buildConfiguration({ password: '' }, []),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      const errorMessage = 'Error pinging database';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        ping.mock.mockImplementation(() => {
          throw new MYSQL2Error(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });
  });
});
